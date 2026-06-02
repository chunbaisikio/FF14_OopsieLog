import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = process.env.DB_PATH || join(__dirname, 'data.db');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onResult(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function genId() {
  return crypto.randomUUID();
}

function genCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function ensureUniquePasscode(passcode) {
  const exists = await get(`SELECT id FROM users WHERE passcode = ?`, [passcode]);
  return !exists;
}

async function findUserByPasscode(passcode) {
  return get(`SELECT id, display_name as displayName, passcode FROM users WHERE passcode = ?`, [passcode]);
}

async function buildSessionForPasscode(passcode) {
  const user = await findUserByPasscode(passcode);
  if (!user) return null;

  const membership = await get(
    `SELECT wm.workspace_id as workspaceId, wm.role, w.name as workspaceName, w.invite_code as inviteCode,
            w.workspace_type as workspaceType
     FROM workspace_memberships wm
     JOIN workspaces w ON w.id = wm.workspace_id
     WHERE wm.user_id = ?
     ORDER BY
       CASE wm.role
         WHEN 'admin' THEN 0
         WHEN 'captain' THEN 1
         ELSE 2
       END,
       wm.joined_at ASC
     LIMIT 1`,
    [user.id]
  );

  if (!membership) return null;

  return {
    userId: user.id,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspaceName,
    displayName: user.displayName,
    role: membership.role,
    workspaceType: membership.workspaceType || (membership.role === 'admin' ? 'admin' : 'captain'),
    passcode,
    inviteCode: membership.workspaceType === 'captain' ? membership.inviteCode : undefined
  };
}

async function getMembershipByPasscode(workspaceId, passcode) {
  return get(
    `SELECT wm.workspace_id as workspaceId, wm.role, u.id as userId, u.display_name as displayName, u.passcode
     FROM workspace_memberships wm
     JOIN users u ON u.id = wm.user_id
     WHERE wm.workspace_id = ? AND u.passcode = ?`,
    [workspaceId, passcode]
  );
}

async function resolveActor(workspaceId, actorPasscode) {
  if (!workspaceId || !actorPasscode) return null;
  return getMembershipByPasscode(String(workspaceId), String(actorPasscode).trim());
}

async function requireActor(res, workspaceId, actorPasscode, allowedRoles = null) {
  const actor = await resolveActor(workspaceId, actorPasscode);
  if (!actor) {
    res.status(403).json({ error: '无效的操作者口令。' });
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(actor.role)) {
    res.status(403).json({ error: '当前角色无权执行该操作。' });
    return null;
  }

  return actor;
}

async function requireAdmin(res, actorPasscode) {
  const session = await buildSessionForPasscode(String(actorPasscode || '').trim());
  if (!session || session.role !== 'admin') {
    res.status(403).json({ error: '当前口令不是管理员身份。' });
    return null;
  }
  return session;
}

async function getWorkspaceSnapshot(workspaceId) {
  const row = await get(
    `SELECT value FROM workspace_store
     WHERE workspace_id = ? AND key = ?`,
    [workspaceId, `ff14oopsie-v2-storage:${workspaceId}`]
  );

  if (!row?.value) return null;

  try {
    return JSON.parse(row.value);
  } catch (_error) {
    return null;
  }
}

function buildTeamProgressRows(snapshot, workspace) {
  const bossProfiles = snapshot?.state?.bossProfiles ?? snapshot?.bossProfiles ?? [];
  const teams = snapshot?.state?.teams ?? snapshot?.teams ?? [];
  const mistakes = snapshot?.state?.mistakes ?? snapshot?.mistakes ?? [];

  return teams.flatMap((team) => {
    const boss = bossProfiles.find((item) => item.id === team.bossId);
    if (!boss) return [];

    const partScale = boss.parts.map((part) => part.id);
    const mechanicScale = boss.parts.flatMap((part) =>
      part.mechanics.map((mechanic) => ({
        mechanicId: mechanic.id,
        label: `${part.name} / ${mechanic.shortName || mechanic.officialName}`
      }))
    );

    const teamMistakes = mistakes.filter((mistake) => mistake.teamId === team.id);
    let maxPartIdx = -1;
    let maxMechIdx = -1;

    teamMistakes.forEach((mistake) => {
      const partIdx = partScale.indexOf(mistake.partId);
      const mechIdx = mechanicScale.findIndex((item) => item.mechanicId === mistake.mechanicId);
      if (partIdx > maxPartIdx) maxPartIdx = partIdx;
      if (mechIdx > maxMechIdx) maxMechIdx = mechIdx;
    });

    return [{
      workspaceId: workspace.workspaceId,
      workspaceName: workspace.workspaceName,
      captainName: workspace.captainName,
      bossId: boss.id,
      bossName: boss.name,
      teamId: team.id,
      teamName: team.name,
      currentPart: maxPartIdx >= 0 ? boss.parts[maxPartIdx]?.name ?? '未开荒' : '未开荒',
      currentMechanic: maxMechIdx >= 0 ? mechanicScale[maxMechIdx]?.label ?? '未触达' : '未触达',
      activeDays: new Set(teamMistakes.map((mistake) => mistake.date)).size,
      totalPulls: teamMistakes.reduce((max, mistake) => Math.max(max, mistake.pullNumber || 0), 0),
      progressScore: maxMechIdx >= 0 ? maxMechIdx + 1 : 0,
      partScore: maxPartIdx >= 0 ? maxPartIdx + 1 : 0
    }];
  });
}

function canCreateInvite(role, targetRole) {
  return targetRole === 'member' && (role === 'captain' || role === 'member');
}

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL,
      workspace_type TEXT NOT NULL DEFAULT 'captain',
      owner_user_id TEXT,
      created_at TEXT NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      passcode TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS workspace_memberships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      UNIQUE(workspace_id, user_id)
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS workspace_invites (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      consumed_by_user_id TEXT,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS captain_invites (
      id TEXT PRIMARY KEY,
      invite_code TEXT NOT NULL UNIQUE,
      created_by_user_id TEXT NOT NULL,
      consumed_by_user_id TEXT,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS workspace_store (
      workspace_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_by TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, key)
    )`
  );

  db.run(`ALTER TABLE workspaces ADD COLUMN workspace_type TEXT NOT NULL DEFAULT 'captain'`, () => {});
  db.run(`ALTER TABLE workspaces ADD COLUMN owner_user_id TEXT`, () => {});

  db.run(
    `UPDATE workspaces
     SET workspace_type = 'admin'
     WHERE id IN (
       SELECT workspace_id
       FROM workspace_memberships
       WHERE role = 'admin'
     )`
  );

  db.run(
    `UPDATE workspaces
     SET workspace_type = 'captain'
     WHERE workspace_type IS NULL OR workspace_type NOT IN ('admin', 'captain')`
  );

  db.run(
    `UPDATE workspaces
     SET owner_user_id = (
       SELECT wm.user_id
       FROM workspace_memberships wm
       WHERE wm.workspace_id = workspaces.id AND wm.role = 'captain'
       LIMIT 1
     )
     WHERE workspace_type = 'captain' AND owner_user_id IS NULL`
  );
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ff14-oopsie-team-server' });
});

app.get('/api/auth/status', async (_req, res) => {
  const adminExists = await get(`SELECT id FROM workspace_memberships WHERE role = 'admin' LIMIT 1`);
  res.json({ hasAdmin: Boolean(adminExists) });
});

app.post('/api/auth/bootstrap', async (req, res) => {
  const { workspaceName, displayName, passcode } = req.body ?? {};

  if (!workspaceName || !displayName || !passcode) {
    res.status(400).json({ error: 'workspaceName, displayName and passcode are required.' });
    return;
  }

  const adminExists = await get(`SELECT id FROM workspace_memberships WHERE role = 'admin' LIMIT 1`);
  if (adminExists) {
    res.status(409).json({ error: '管理员已存在，请直接使用口令登录。' });
    return;
  }

  if (!(await ensureUniquePasscode(passcode))) {
    res.status(409).json({ error: '该口令已被占用，请更换一个。' });
    return;
  }

  try {
    const workspaceId = genId();
    const userId = genId();
    let inviteCode = genCode();

    while (await get(`SELECT id FROM workspaces WHERE invite_code = ?`, [inviteCode])) {
      inviteCode = genCode();
    }

    await run(
      `INSERT INTO workspaces (id, name, invite_code, created_by, workspace_type, owner_user_id, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?, datetime('now'))`,
      [workspaceId, String(workspaceName).trim(), inviteCode, String(displayName).trim(), userId]
    );

    await run(
      `INSERT INTO users (id, display_name, passcode, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [userId, String(displayName).trim(), String(passcode).trim()]
    );

    await run(
      `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, joined_at)
       VALUES (?, ?, ?, 'admin', datetime('now'))`,
      [genId(), workspaceId, userId]
    );

    const session = await buildSessionForPasscode(String(passcode).trim());
    res.status(201).json({ session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to bootstrap admin.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { passcode } = req.body ?? {};

  if (!passcode) {
    res.status(400).json({ error: 'passcode is required.' });
    return;
  }

  const session = await buildSessionForPasscode(String(passcode).trim());
  if (!session) {
    res.status(404).json({ error: '口令不存在或尚未加入工作空间。' });
    return;
  }

  res.json({ session });
});

app.get('/api/admin/captains', async (req, res) => {
  const admin = await requireAdmin(res, req.query.actorPasscode);
  if (!admin) return;

  try {
    const workspaces = await all(
      `SELECT w.id as workspaceId, w.name as workspaceName, w.invite_code as inviteCode, w.created_at as createdAt,
              u.display_name as captainName, u.passcode as captainPasscode,
              COUNT(DISTINCT wm.user_id) as memberCount
       FROM workspaces w
       JOIN users u ON u.id = w.owner_user_id
       LEFT JOIN workspace_memberships wm ON wm.workspace_id = w.id
       WHERE w.workspace_type = 'captain'
       GROUP BY w.id, w.name, w.invite_code, w.created_at, u.display_name, u.passcode
       ORDER BY w.created_at DESC`
    );

    res.json({ workspaces });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load captain workspaces.' });
  }
});

app.get('/api/admin/captain-invites', async (req, res) => {
  const admin = await requireAdmin(res, req.query.actorPasscode);
  if (!admin) return;

  try {
    const invites = await all(
      `SELECT ci.id, ci.invite_code as inviteCode, ci.created_at as createdAt, ci.consumed_at as consumedAt,
              u.display_name as createdBy
       FROM captain_invites ci
       JOIN users u ON u.id = ci.created_by_user_id
       ORDER BY ci.created_at DESC`
    );

    res.json({ invites });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load captain invites.' });
  }
});

app.post('/api/admin/captain-invites', async (req, res) => {
  const admin = await requireAdmin(res, req.body?.actorPasscode);
  if (!admin) return;

  let inviteCode = genCode();
  while (
    (await get(`SELECT id FROM captain_invites WHERE invite_code = ?`, [inviteCode])) ||
    (await get(`SELECT id FROM workspace_invites WHERE invite_code = ?`, [inviteCode])) ||
    (await get(`SELECT id FROM workspaces WHERE invite_code = ?`, [inviteCode]))
  ) {
    inviteCode = genCode();
  }

  try {
    await run(
      `INSERT INTO captain_invites (id, invite_code, created_by_user_id, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [genId(), inviteCode, admin.userId]
    );

    res.status(201).json({ inviteCode, role: 'captain' });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create captain invite.' });
  }
});

app.get('/api/admin/progress', async (req, res) => {
  const admin = await requireAdmin(res, req.query.actorPasscode);
  if (!admin) return;

  try {
    const workspaces = await all(
      `SELECT w.id as workspaceId, w.name as workspaceName, u.display_name as captainName
       FROM workspaces w
       JOIN users u ON u.id = w.owner_user_id
       WHERE w.workspace_type = 'captain'
       ORDER BY w.created_at DESC`
    );

    const rows = [];
    for (const workspace of workspaces) {
      const snapshot = await getWorkspaceSnapshot(workspace.workspaceId);
      if (!snapshot) continue;
      rows.push(...buildTeamProgressRows(snapshot, workspace));
    }

    res.json({ rows });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to build progress board.' });
  }
});

app.get('/api/workspaces/:id/users', async (req, res) => {
  const actor = await requireActor(
    res,
    req.params.id,
    req.query.actorPasscode
  );
  if (!actor) return;

  try {
    const users = await all(
      `SELECT u.id, u.display_name as displayName, u.passcode, wm.role, wm.joined_at as joinedAt
       FROM workspace_memberships wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ?
       ORDER BY
         CASE wm.role
           WHEN 'admin' THEN 0
           WHEN 'captain' THEN 1
           ELSE 2
         END,
         wm.joined_at ASC`,
      [req.params.id]
    );

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load users.' });
  }
});

app.get('/api/workspaces/:id/invites', async (req, res) => {
  const actor = await requireActor(
    res,
    req.params.id,
    req.query.actorPasscode
  );
  if (!actor) return;

  try {
    const invites = await all(
      `SELECT wi.id, wi.invite_code as inviteCode, wi.role, wi.created_at as createdAt, wi.consumed_at as consumedAt,
              u.display_name as createdBy
       FROM workspace_invites wi
       JOIN users u ON u.id = wi.created_by_user_id
       WHERE wi.workspace_id = ?
       ORDER BY wi.created_at DESC`,
      [req.params.id]
    );
    res.json({ invites });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load invites.' });
  }
});

app.post('/api/workspaces/:id/invites', async (req, res) => {
  const { actorPasscode, role } = req.body ?? {};
  const workspaceId = req.params.id;

  if (!actorPasscode || !role) {
    res.status(400).json({ error: 'actorPasscode and role are required.' });
    return;
  }

  if (role !== 'member') {
    res.status(400).json({ error: '工作空间内只支持邀请 member。' });
    return;
  }

  const actor = await resolveActor(workspaceId, actorPasscode);
  if (!actor) {
    res.status(403).json({ error: '无效的操作者口令。' });
    return;
  }

  if (!canCreateInvite(actor.role, role)) {
    res.status(403).json({ error: '当前角色无权发起该邀请。' });
    return;
  }

  let inviteCode = genCode();
  while (await get(`SELECT id FROM workspace_invites WHERE invite_code = ?`, [inviteCode])) {
    inviteCode = genCode();
  }

  try {
    await run(
      `INSERT INTO workspace_invites (id, workspace_id, invite_code, role, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [genId(), workspaceId, inviteCode, role, actor.userId]
    );

    res.status(201).json({ inviteCode, role });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create invite.' });
  }
});

app.post('/api/invites/redeem', async (req, res) => {
  const { inviteCode, displayName, passcode } = req.body ?? {};

  if (!inviteCode || !displayName || !passcode) {
    res.status(400).json({ error: 'inviteCode, displayName and passcode are required.' });
    return;
  }

  if (!(await ensureUniquePasscode(passcode))) {
    res.status(409).json({ error: '该口令已被占用，请更换一个。' });
    return;
  }

  const normalizedInviteCode = String(inviteCode).trim().toUpperCase();
  const captainInvite = await get(
    `SELECT id, consumed_by_user_id as consumedByUserId
     FROM captain_invites WHERE invite_code = ?`,
    [normalizedInviteCode]
  );

  if (captainInvite) {
    if (captainInvite.consumedByUserId) {
      res.status(409).json({ error: '该邀请码已被使用。' });
      return;
    }

    try {
      const userId = genId();
      const workspaceId = genId();
      let workspaceCode = genCode();

      while (
        (await get(`SELECT id FROM workspaces WHERE invite_code = ?`, [workspaceCode])) ||
        (await get(`SELECT id FROM workspace_invites WHERE invite_code = ?`, [workspaceCode])) ||
        (await get(`SELECT id FROM captain_invites WHERE invite_code = ?`, [workspaceCode]))
      ) {
        workspaceCode = genCode();
      }

      await run(
        `INSERT INTO users (id, display_name, passcode, created_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [userId, String(displayName).trim(), String(passcode).trim()]
      );

      await run(
        `INSERT INTO workspaces (id, name, invite_code, created_by, workspace_type, owner_user_id, created_at)
         VALUES (?, ?, ?, ?, 'captain', ?, datetime('now'))`,
        [workspaceId, `${String(displayName).trim()} 的工作空间`, workspaceCode, String(displayName).trim(), userId]
      );

      await run(
        `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, joined_at)
         VALUES (?, ?, ?, 'captain', datetime('now'))`,
        [genId(), workspaceId, userId]
      );

      await run(
        `UPDATE captain_invites
         SET consumed_by_user_id = ?, consumed_at = datetime('now')
         WHERE id = ?`,
        [userId, captainInvite.id]
      );

      const session = await buildSessionForPasscode(String(passcode).trim());
      res.status(201).json({ session });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create captain workspace.' });
    }
    return;
  }

  const invite = await get(
    `SELECT id, workspace_id as workspaceId, role, consumed_by_user_id as consumedByUserId
     FROM workspace_invites WHERE invite_code = ?`,
    [normalizedInviteCode]
  );

  if (!invite) {
    const workspace = await get(
      `SELECT id as workspaceId, workspace_type as workspaceType FROM workspaces WHERE invite_code = ?`,
      [normalizedInviteCode]
    );

    if (!workspace) {
      res.status(404).json({ error: '邀请码不存在。' });
      return;
    }

    if (workspace.workspaceType !== 'captain') {
      res.status(403).json({ error: '管理员控制台不支持通过通用邀请码加入。' });
      return;
    }

    try {
      const userId = genId();

      await run(
        `INSERT INTO users (id, display_name, passcode, created_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [userId, String(displayName).trim(), String(passcode).trim()]
      );

      await run(
        `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, joined_at)
         VALUES (?, ?, ?, 'member', datetime('now'))`,
        [genId(), workspace.workspaceId, userId]
      );

      const session = await buildSessionForPasscode(String(passcode).trim());
      res.status(201).json({ session });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to join workspace.' });
    }
    return;
  }

  if (invite.consumedByUserId) {
    res.status(409).json({ error: '该邀请码已被使用。' });
    return;
  }

  try {
    const userId = genId();

    await run(
      `INSERT INTO users (id, display_name, passcode, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [userId, String(displayName).trim(), String(passcode).trim()]
    );

    await run(
        `INSERT INTO workspace_memberships (id, workspace_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [genId(), invite.workspaceId, userId, invite.role]
    );

    await run(
      `UPDATE workspace_invites
       SET consumed_by_user_id = ?, consumed_at = datetime('now')
       WHERE id = ?`,
      [userId, invite.id]
    );

    const session = await buildSessionForPasscode(String(passcode).trim());
    res.status(201).json({ session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to redeem invite.' });
  }
});

app.get('/api/store', async (req, res) => {
  const { key, workspaceId, actorPasscode } = req.query;

  if (!key || !workspaceId || !actorPasscode) {
    res.status(400).json({ error: 'workspaceId, key and actorPasscode are required.' });
    return;
  }

  const actor = await requireActor(res, workspaceId, actorPasscode);
  if (!actor) return;

  try {
    const row = await get(
      `SELECT value FROM workspace_store WHERE workspace_id = ? AND key = ?`,
      [workspaceId, key]
    );

    if (!row) {
      res.json({ value: null });
      return;
    }

    try {
      res.json({ value: JSON.parse(row.value) });
    } catch (_error) {
      res.json({ value: row.value });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load store.' });
  }
});

app.post('/api/store', async (req, res) => {
  const { workspaceId, key, value, actorPasscode } = req.body ?? {};

  if (!workspaceId || !key || !actorPasscode) {
    res.status(400).json({ error: 'workspaceId, key and actorPasscode are required.' });
    return;
  }

  const actor = await requireActor(res, workspaceId, actorPasscode);
  if (!actor) return;

  try {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    await run(
      `INSERT INTO workspace_store (workspace_id, key, value, updated_by, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(workspace_id, key)
       DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
      [workspaceId, key, valueStr, actor.passcode]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save store.' });
  }
});

app.use((_req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});
