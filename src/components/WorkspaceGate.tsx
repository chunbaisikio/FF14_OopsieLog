import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { setWorkspaceSession, type WorkspaceRole } from '../utils/session';
import { fetchJson } from '../utils/http';

type AuthResponse = {
  session: {
    userId: string;
    workspaceId: string;
    workspaceName: string;
    displayName: string;
    role: WorkspaceRole;
    workspaceType: 'admin' | 'captain';
    passcode: string;
    inviteCode?: string;
  };
};

type AuthStatus = {
  hasAdmin: boolean;
};

export default function WorkspaceGate() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [tab, setTab] = useState<'login' | 'bootstrap' | 'invite'>('login');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [loginPasscode, setLoginPasscode] = useState('');

  const [workspaceName, setWorkspaceName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');

  const [inviteCode, setInviteCode] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePasscode, setInvitePasscode] = useState('');

  useEffect(() => {
    fetchJson<AuthStatus>('/api/auth/status')
      .then((payload: AuthStatus) => {
        setStatus(payload);
        if (!payload.hasAdmin) {
          setTab('bootstrap');
        }
      })
      .catch((error) => {
        setStatus({ hasAdmin: false });
        setMessage(error instanceof Error ? error.message : '工作空间状态加载失败');
        setTab('bootstrap');
      });
  }, []);

  const canLogin = useMemo(() => loginPasscode.trim().length > 0, [loginPasscode]);
  const canBootstrap = useMemo(
    () => workspaceName.trim() && adminName.trim() && adminPasscode.trim(),
    [workspaceName, adminName, adminPasscode]
  );
  const canRedeemInvite = useMemo(
    () => inviteCode.trim() && inviteName.trim() && invitePasscode.trim(),
    [inviteCode, inviteName, invitePasscode]
  );

  async function submit(endpoint: string, payload: Record<string, string>) {
    setSubmitting(true);
    setMessage('');

    try {
      const authData = await fetchJson<AuthResponse>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setWorkspaceSession(authData.session);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '网络异常，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-5 text-center shadow-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-blue-300">Auth Bootstrap</p>
          <p className="mt-3 text-sm text-slate-400">正在检查工作空间登录状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.25),_transparent_36%),linear-gradient(180deg,_rgba(15,23,42,1),_rgba(2,6,23,1))] p-8 shadow-2xl">
            <div className="mb-4 inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-blue-300 uppercase">
              Workspace Access
            </div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              用口令驱动的队内复盘工作空间
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
              当前版本把登录方式改成口令制。管理员只负责邀请队长，队长兑换邀请码后会自动获得独立工作空间，
              后续成员都加入对应队长的空间内协作。
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <InfoCard title="口令登录" body="用户进入系统只使用口令登录，适合固定队内部快速协作和记账式审计。" />
              <InfoCard title="角色分层" body="管理员只管理 captain；每个 captain 都拥有自己的独立工作空间与成员名单。" />
              <InfoCard title="跨队对比" body="管理员可跨 captain 工作空间查看同一副本的多队进度，对比当前层数和投入时长。" />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
            <div className="mb-4 flex gap-2 rounded-full bg-slate-950 p-1">
              <TabButton active={tab === 'login'} onClick={() => setTab('login')}>
                口令登录
              </TabButton>
              {!status.hasAdmin && (
                <TabButton active={tab === 'bootstrap'} onClick={() => setTab('bootstrap')}>
                  初始化管理员
                </TabButton>
              )}
              <TabButton active={tab === 'invite'} onClick={() => setTab('invite')}>
                邀请码入场
              </TabButton>
            </div>

            {tab === 'login' && (
              <div className="space-y-4">
                <Field label="登录口令">
                  <input
                    value={loginPasscode}
                    onChange={(event) => setLoginPasscode(event.target.value)}
                    placeholder="输入你的专属口令"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  />
                </Field>
                <PrimaryButton
                  disabled={!canLogin || submitting}
                  onClick={() => submit('/api/auth/login', { passcode: loginPasscode.trim() })}
                >
                  {submitting ? '登录中...' : '进入工作空间'}
                </PrimaryButton>
              </div>
            )}

            {tab === 'bootstrap' && !status.hasAdmin && (
              <div className="space-y-4">
                <Field label="工作空间名称">
                  <input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="例如：绝小丑攻略组"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  />
                </Field>
                <Field label="管理员显示名">
                  <input
                    value={adminName}
                    onChange={(event) => setAdminName(event.target.value)}
                    placeholder="例如：丝瓜卡夫卡"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  />
                </Field>
                <Field label="管理员口令">
                  <input
                    value={adminPasscode}
                    onChange={(event) => setAdminPasscode(event.target.value)}
                    placeholder="例如：SGKF-ADMIN-001"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  />
                </Field>
                <PrimaryButton
                  disabled={!canBootstrap || submitting}
                  onClick={() =>
                    submit('/api/auth/bootstrap', {
                      workspaceName: workspaceName.trim(),
                      displayName: adminName.trim(),
                      passcode: adminPasscode.trim()
                    })
                  }
                >
                  {submitting ? '创建中...' : '创建管理员并进入'}
                </PrimaryButton>
              </div>
            )}

            {tab === 'invite' && (
              <div className="space-y-4">
                <Field label="邀请码">
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="例如：AB12CD"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase text-white outline-none transition focus:border-blue-400"
                  />
                </Field>
                <Field label="显示名">
                  <input
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="例如：阿库娅"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  />
                </Field>
                <Field label="你的登录口令">
                  <input
                    value={invitePasscode}
                    onChange={(event) => setInvitePasscode(event.target.value)}
                    placeholder="例如：AKY-MEMBER-002"
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-400"
                  />
                </Field>
                <PrimaryButton
                  disabled={!canRedeemInvite || submitting}
                  onClick={() =>
                    submit('/api/invites/redeem', {
                      inviteCode: inviteCode.trim().toUpperCase(),
                      displayName: inviteName.trim(),
                      passcode: invitePasscode.trim()
                    })
                  }
                >
                  {submitting ? '加入中...' : '使用邀请码加入'}
                </PrimaryButton>
              </div>
            )}

            <p className="mt-4 min-h-6 text-sm text-amber-300">{message}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-300">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-400">{body}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  disabled,
  onClick,
  children
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl bg-blue-500 px-4 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-700"
    >
      {children}
    </button>
  );
}
