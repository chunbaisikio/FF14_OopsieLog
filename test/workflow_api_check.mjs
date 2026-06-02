import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const tempDir = mkdtempSync(join(tmpdir(), 'ff14-oopsie-workflow-'));
const port = String(34000 + Math.floor(Math.random() * 1000));

process.env.PORT = port;
process.env.HOST = '127.0.0.1';
process.env.DB_PATH = join(tempDir, 'workflow.db');

await import(resolve(repoRoot, 'server/server.js'));
await sleep(300);

try {
  const statusBefore = await request('/api/auth/status');
  assert.equal(statusBefore.hasAdmin, false);
  logOk('auth status before bootstrap');

  const bootstrap = await request('/api/auth/bootstrap', {
    method: 'POST',
    body: {
      workspaceName: '流程测试工作区',
      displayName: 'Admin',
      passcode: 'ADMIN-001'
    }
  });
  assert.equal(bootstrap.session.role, 'admin');
  const workspaceId = bootstrap.session.workspaceId;
  logOk('bootstrap admin workspace');

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { passcode: 'ADMIN-001' }
  });
  assert.equal(login.session.workspaceId, workspaceId);
  logOk('admin login by passcode');

  const captainInvite = await request(`/api/admin/captain-invites`, {
    method: 'POST',
    body: { actorPasscode: 'ADMIN-001' }
  });
  assert.equal(captainInvite.role, 'captain');
  logOk('admin invite captain');

  const captainRedeem = await request('/api/invites/redeem', {
    method: 'POST',
    body: {
      inviteCode: captainInvite.inviteCode,
      displayName: 'Captain',
      passcode: 'CAPTAIN-001'
    }
  });
  assert.equal(captainRedeem.session.role, 'captain');
  assert.equal(captainRedeem.session.workspaceType, 'captain');
  logOk('captain redeem invite');

  const captainWorkspaceId = captainRedeem.session.workspaceId;
  const memberInvite = await request(`/api/workspaces/${captainWorkspaceId}/invites`, {
    method: 'POST',
    body: { actorPasscode: 'CAPTAIN-001', role: 'member' }
  });
  assert.equal(memberInvite.role, 'member');
  logOk('captain invite member');

  const memberRedeem = await request('/api/invites/redeem', {
    method: 'POST',
    body: {
      inviteCode: memberInvite.inviteCode,
      displayName: 'Member',
      passcode: 'MEMBER-001'
    }
  });
  assert.equal(memberRedeem.session.role, 'member');
  assert.equal(memberRedeem.session.workspaceId, captainWorkspaceId);
  logOk('member redeem invite');

  const memberInviteMember = await request(`/api/workspaces/${captainWorkspaceId}/invites`, {
    method: 'POST',
    body: { actorPasscode: 'MEMBER-001', role: 'member' }
  });
  assert.equal(memberInviteMember.role, 'member');
  logOk('member can invite member');

  const memberInviteCaptain = await requestRaw(`/api/workspaces/${captainWorkspaceId}/invites`, {
    method: 'POST',
    body: { actorPasscode: 'MEMBER-001', role: 'captain' }
  });
  assert.equal(memberInviteCaptain.status, 400);
  assert.match(memberInviteCaptain.body.error, /只支持邀请 member/);
  logOk('member cannot invite captain');

  const usersByMember = await request(`/api/workspaces/${captainWorkspaceId}/users?actorPasscode=MEMBER-001`);
  assert.equal(usersByMember.users.length, 2);
  logOk('member can list workspace users');

  const adminView = await request(`/api/admin/captains?actorPasscode=ADMIN-001`);
  assert.equal(adminView.workspaces.length, 1);
  assert.equal(adminView.workspaces[0].workspaceId, captainWorkspaceId);
  logOk('admin can inspect captain workspaces');

  const storeSave = await request('/api/store', {
    method: 'POST',
    body: {
      workspaceId: captainWorkspaceId,
      actorPasscode: 'MEMBER-001',
      key: `ff14oopsie-v2-storage:${captainWorkspaceId}`,
      value: { ok: true, actor: 'member' }
    }
  });
  assert.equal(storeSave.success, true);

  const storeLoad = await request(`/api/store?workspaceId=${captainWorkspaceId}&actorPasscode=MEMBER-001&key=ff14oopsie-v2-storage:${captainWorkspaceId}`);
  assert.deepEqual(storeLoad.value, { ok: true, actor: 'member' });
  logOk('store save/load with actor passcode');

  console.log('Workflow API check passed.');
  process.exitCode = 0;
} catch (error) {
  console.error('Workflow API check failed.');
  console.error(error);
  process.exitCode = 1;
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  process.exit(process.exitCode ?? 0);
}

async function request(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`request failed ${path}: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function requestRaw(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  return { status: response.status, body };
}

function logOk(label) {
  console.log(`[ok] ${label}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
