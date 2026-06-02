import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import {
  Settings as SettingsIcon,
  Save,
  Upload,
  AlertTriangle,
  Trash2,
  Activity,
  CheckCircle2,
  Users,
  KeyRound,
  Shield
} from 'lucide-react';
import { getWorkspaceSession, type WorkspaceRole } from '../utils/session';
import { fetchJson } from '../utils/http';

type WorkspaceUser = {
  id: string;
  displayName: string;
  passcode: string;
  role: WorkspaceRole;
  joinedAt: string;
};

type WorkspaceInvite = {
  id: string;
  inviteCode: string;
  role: WorkspaceRole;
  createdAt: string;
  consumedAt?: string;
  createdBy: string;
};

type CaptainInvite = {
  id: string;
  inviteCode: string;
  createdAt: string;
  consumedAt?: string;
  createdBy: string;
};

type CaptainWorkspace = {
  workspaceId: string;
  workspaceName: string;
  inviteCode: string;
  createdAt: string;
  captainName: string;
  captainPasscode: string;
  memberCount: number;
};

export default function Settings() {
  const store = useAppStore();
  const session = getWorkspaceSession();
  const isAdmin = session?.role === 'admin';

  const [importStr, setImportStr] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInvite[]>([]);
  const [captainInvites, setCaptainInvites] = useState<CaptainInvite[]>([]);
  const [captainWorkspaces, setCaptainWorkspaces] = useState<CaptainWorkspace[]>([]);
  const [inviteStatus, setInviteStatus] = useState('');

  const [localConsent, setLocalConsent] = useState(store.telemetryConsent);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setLocalConsent(store.telemetryConsent);
  }, [store.telemetryConsent]);

  useEffect(() => {
    if (!session?.passcode) return;

    if (isAdmin) {
      Promise.all([
        fetchJson<{ invites: CaptainInvite[] }>(`/api/admin/captain-invites?actorPasscode=${session.passcode}`),
        fetchJson<{ workspaces: CaptainWorkspace[] }>(`/api/admin/captains?actorPasscode=${session.passcode}`)
      ])
        .then(([inviteData, workspaceData]) => {
          setCaptainInvites(inviteData.invites ?? []);
          setCaptainWorkspaces(workspaceData.workspaces ?? []);
        })
        .catch((error) => {
          setInviteStatus(error instanceof Error ? error.message : '队长管理信息加载失败。');
        });
      return;
    }

    if (!session.workspaceId) return;
    const params = new URLSearchParams({ actorPasscode: session.passcode });
    Promise.all([
      fetchJson<{ users: WorkspaceUser[] }>(`/api/workspaces/${session.workspaceId}/users?${params.toString()}`),
      fetchJson<{ invites: WorkspaceInvite[] }>(`/api/workspaces/${session.workspaceId}/invites?${params.toString()}`)
    ])
      .then(([usersData, invitesData]) => {
        setWorkspaceUsers(usersData.users ?? []);
        setWorkspaceInvites(invitesData.invites ?? []);
      })
      .catch((error) => {
        setInviteStatus(error instanceof Error ? error.message : '工作空间信息加载失败。');
      });
  }, [session?.passcode, session?.workspaceId, isAdmin]);

  const myIdentity = useMemo(() => {
    if (!session) return null;
    return workspaceUsers.find((user) => user.passcode === session.passcode) ?? {
      id: session.userId,
      displayName: session.displayName,
      passcode: session.passcode,
      role: session.role,
      joinedAt: '-'
    };
  }, [session, workspaceUsers]);

  const handleSaveTelemetry = () => {
    store.setTelemetryConsent(localConsent);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 5000);
  };

  const handleExport = () => {
    const data = {
      bossProfiles: store.bossProfiles,
      teams: store.teams,
      activeTeamId: store.activeTeamId,
      mistakes: store.mistakes,
      progress: store.progress
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ff14oopsie_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImport = () => {
    try {
      const data = JSON.parse(importStr);
      if (data.bossProfiles && data.teams && data.mistakes) {
        if (confirm('警告：此操作将覆盖您当前的全部数据，且不可逆！确定要继续吗？')) {
          store.importData(data);
          setImportStatus('✅ 数据恢复成功！');
          setImportStr('');
        }
      } else {
        setImportStatus('❌ 无效的备份文件格式。');
      }
    } catch (_error) {
      setImportStatus('❌ 解析失败，请检查文本是否为有效的 JSON。');
    }
  };

  const handleClear = () => {
    if (confirm('危险操作：这将清空应用内的所有数据并重置为空白状态。确定吗？')) {
      if (confirm('最后一次确认，是否彻底清空？')) {
        store.clearAllData();
        setImportStatus('🗑️ 数据已清空。');
      }
    }
  };

  const handleCreateInvite = async () => {
    if (!session?.passcode) return;

    try {
      setInviteStatus('');
      if (isAdmin) {
        const data = await fetchJson<{ inviteCode: string }>(`/api/admin/captain-invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actorPasscode: session.passcode })
        });

        setInviteStatus(`✅ 已创建 captain 邀请码：${data.inviteCode}`);
        const inviteData = await fetchJson<{ invites: CaptainInvite[] }>(`/api/admin/captain-invites?actorPasscode=${session.passcode}`);
        setCaptainInvites(inviteData.invites ?? []);
        return;
      }

      const data = await fetchJson<{ inviteCode: string }>(`/api/workspaces/${session.workspaceId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actorPasscode: session.passcode,
          role: 'member'
        })
      });

      setInviteStatus(`✅ 已创建 member 邀请码：${data.inviteCode}`);
      const params = new URLSearchParams({ actorPasscode: session.passcode });
      const invitesData = await fetchJson<{ invites: WorkspaceInvite[] }>(`/api/workspaces/${session.workspaceId}/invites?${params.toString()}`);
      setWorkspaceInvites(invitesData.invites ?? []);
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : '邀请码创建失败。');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 gap-6">
      <div className="flex items-center gap-2 mb-2">
        <SettingsIcon className="text-blue-400" size={24} />
        <h1 className="text-2xl font-bold text-white">{isAdmin ? '管理员总控台' : '工作空间与系统设置'}</h1>
      </div>

      {session && (
        <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-blue-400 font-bold">
              <Shield size={20} /> 当前登录身份
            </div>
            <InfoRow label="工作空间" value={isAdmin ? '管理员总控台' : session.workspaceName} />
            <InfoRow label="显示名" value={session.displayName} />
            <InfoRow label="角色" value={session.role} />
            <InfoRow label="登录口令" value={session.passcode} mono />
            {!isAdmin && <InfoRow label="工作区通用邀请码" value={session.inviteCode ?? '-'} mono />}
            {!isAdmin && myIdentity && <InfoRow label="加入时间" value={myIdentity.joinedAt} />}
          </div>

          {isAdmin ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Users size={20} /> 队长管理
                </div>
                <button
                  onClick={handleCreateInvite}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-2 text-sm font-medium transition-colors"
                >
                  生成队长邀请码
                </button>
              </div>

              <div className="border border-slate-700 rounded-xl bg-slate-900/50 p-4">
                <div className="flex items-center gap-2 text-yellow-400 font-bold mb-3">
                  <KeyRound size={18} /> 队长邀请码
                </div>
                <div className="space-y-2 text-sm">
                  {captainInvites.length > 0 ? (
                    captainInvites.map((invite) => (
                      <div key={invite.id} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 flex flex-wrap items-center gap-3">
                        <span className="font-mono text-blue-300">{invite.inviteCode}</span>
                        <span className="text-slate-500">创建者 {invite.createdBy}</span>
                        <span className="text-slate-500">{invite.consumedAt ? `已使用 ${invite.consumedAt}` : '待使用'}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">当前还没有生成过队长邀请码。</p>
                  )}
                </div>
              </div>

              <div className="border border-slate-700 rounded-xl bg-slate-900/50 p-4">
                <h2 className="text-white font-bold mb-3">Captain 工作空间</h2>
                <div className="space-y-3">
                  {captainWorkspaces.length > 0 ? (
                    captainWorkspaces.map((workspace) => (
                      <div key={workspace.workspaceId} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-white font-semibold">{workspace.workspaceName}</div>
                            <div className="mt-1 text-sm text-slate-400">
                              队长 {workspace.captainName} · 口令 {workspace.captainPasscode}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="font-mono text-cyan-300">工作区码 {workspace.inviteCode}</div>
                            <div className="text-slate-500">成员数 {workspace.memberCount}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">当前还没有 captain 工作空间。</p>
                  )}
                </div>
              </div>

              <p className="text-sm text-amber-300">{inviteStatus}</p>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Users size={20} /> 当前工作空间成员
                </div>
                <button
                  onClick={handleCreateInvite}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded px-3 py-2 text-sm font-medium transition-colors"
                >
                  生成成员邀请码
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400">
                    <tr className="border-b border-slate-700">
                      <th className="py-2 text-left">用户</th>
                      <th className="py-2 text-left">角色</th>
                      <th className="py-2 text-left">口令</th>
                      <th className="py-2 text-left">加入时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspaceUsers.map((user) => (
                      <tr key={user.id} className="border-b border-slate-800 last:border-b-0">
                        <td className="py-3 text-white">{user.displayName}</td>
                        <td className="py-3 text-slate-300">{user.role}</td>
                        <td className="py-3 font-mono text-blue-300">{user.passcode}</td>
                        <td className="py-3 text-slate-400">{user.joinedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center gap-2 text-yellow-400 font-bold mb-3">
                  <KeyRound size={18} /> 成员邀请码记录
                </div>
                <p className="mb-3 text-sm text-slate-400">
                  顶部显示的工作区通用邀请码可重复用于成员加入；这里生成的是一次性 member 邀请码。
                </p>
                <div className="space-y-2 text-sm">
                  {workspaceInvites.length > 0 ? (
                    workspaceInvites.map((invite) => (
                      <div key={invite.id} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 flex flex-wrap items-center gap-3">
                        <span className="font-mono text-blue-300">{invite.inviteCode}</span>
                        <span className="text-slate-300">{invite.role}</span>
                        <span className="text-slate-500">创建者 {invite.createdBy}</span>
                        <span className="text-slate-500">{invite.consumedAt ? `已使用 ${invite.consumedAt}` : '待使用'}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">当前还没有生成过成员邀请码。</p>
                  )}
                </div>
                <p className="mt-3 text-sm text-amber-300">{inviteStatus}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!isAdmin && (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 text-blue-400 font-bold mb-2">
              <Activity size={20} /> 统计与遥测 <span className="text-sm text-slate-400 font-normal">(不勾选也可正常使用)</span>
            </div>
            <p className="text-sm text-slate-400 mb-2">
              遥测数据将帮助我们优化应用。这些数据仅用于在 NGA 等平台发表相关副本的宏观犯错率分析贴。
              我们<strong>绝对不会</strong>收集任何用户 ID、队伍名称或团灭备注。
            </p>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConsent}
                  onChange={(e) => setLocalConsent(e.target.checked)}
                  className="w-5 h-5 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500/50"
                />
                <span className="text-sm font-medium text-white select-none">
                  允许匿名发送宏观统计数据
                </span>
              </label>
              <button
                onClick={handleSaveTelemetry}
                className={`px-6 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${isSaved ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
              >
                {isSaved ? (
                  <><CheckCircle2 size={18} /> 已保存</>
                ) : (
                  <><Save size={18} /> 保存更改</>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                <Save size={20} /> 数据备份与导出
              </div>
              <p className="text-sm text-slate-400 mb-4">
                将当前系统中所有的副本模板、队伍信息以及犯错记录全量导出为 JSON 文件。建议您定期备份。
              </p>
              <button
                onClick={handleExport}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-3 flex items-center justify-center gap-2 font-medium transition-colors"
              >
                <Save size={18} /> 导出全量备份 JSON
              </button>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
                <Upload size={20} /> 数据恢复与导入
              </div>
              <p className="text-sm text-slate-400 mb-2">
                如果您有之前导出的 JSON 文件，可以用文本编辑器打开并粘贴在此处进行恢复。
              </p>
              <textarea
                value={importStr}
                onChange={e => setImportStr(e.target.value)}
                className="w-full h-32 bg-slate-900 border border-slate-600 rounded text-sm text-white p-3 font-mono focus:border-blue-500 focus:outline-none"
                placeholder="粘贴 JSON 数据..."
              />
              <button
                onClick={handleImport}
                disabled={!importStr.trim()}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg py-3 flex items-center justify-center gap-2 font-medium transition-colors"
              >
                <Upload size={18} /> 确认导入并覆盖现有数据
              </button>
              {importStatus && <p className="text-sm text-center font-medium mt-2 text-white">{importStatus}</p>}
            </div>
          </div>

          <div className="bg-slate-800 border border-red-900/30 rounded-xl p-6 shadow-sm flex flex-col gap-4 mt-auto">
            <div className="flex items-center gap-2 text-red-500 font-bold mb-2">
              <AlertTriangle size={20} /> 危险区域
            </div>
            <p className="text-sm text-slate-400 mb-4">
              执行此操作将彻底清除当前工作空间中的本地缓存数据。服务端共享数据仍会在下一次同步时回填。
            </p>
            <button
              onClick={handleClear}
              className="w-full md:w-auto bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-700 rounded-lg py-3 px-6 flex items-center justify-center gap-2 font-medium transition-colors"
            >
              <Trash2 size={18} /> 清空本地缓存状态
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
