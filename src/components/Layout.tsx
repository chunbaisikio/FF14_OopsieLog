import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { PenSquare, Users, Swords, Settings, FileText, LogOut, BarChart2 } from 'lucide-react';
import { useAppStore } from '../store';
import WorkspaceGate from './WorkspaceGate';
import { clearWorkspaceSession, getWorkspaceSession } from '../utils/session';

export default function Layout() {
  const location = useLocation();
  const { bossProfiles, teams, isHydrated } = useAppStore();
  const session = getWorkspaceSession();

  if (!session) {
    return <WorkspaceGate />;
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-5 text-center shadow-xl">
          <p className="text-sm uppercase tracking-[0.2em] text-blue-300">Workspace Sync</p>
          <h1 className="mt-2 text-xl font-bold text-white">{session.workspaceName}</h1>
          <p className="mt-3 text-sm text-slate-400">正在同步工作区数据...</p>
        </div>
      </div>
    );
  }

  if (session.role === 'admin') {
    if (!['/settings', '/progress'].includes(location.pathname)) {
      return <Navigate to="/settings" replace />;
    }

    const adminNavItems = [
      { path: '/settings', name: '队长管理', icon: <Settings size={20} /> },
      { path: '/progress', name: '进度总览', icon: <BarChart2 size={20} /> }
    ];

    return (
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-50">
        <header className="bg-slate-800 border-b border-slate-700 shadow-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-lg tracking-wide text-blue-400">
              <span className="bg-blue-500/20 p-1.5 rounded-md">
                <PenSquare size={18} className="text-blue-400" />
              </span>
              FF14 Oopsie Admin
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden xl:flex flex-col items-end text-xs leading-4">
                <span className="text-slate-200 font-semibold">管理员总控台</span>
                <span className="text-slate-400">{session.displayName} · admin</span>
              </div>
              <nav className="flex gap-1">
                {adminNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span className="hidden sm:inline">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <button
                type="button"
                onClick={() => {
                  clearWorkspaceSession();
                  window.location.reload();
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                title="切换工作区"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">切换</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    );
  }

  // Onboarding intercept
  if (bossProfiles.length === 0 || teams.length === 0) {
    if (location.pathname !== '/setup') {
      return <Navigate to="/setup" replace />;
    }
  }

  // If in setup, hide regular navigation
  if (location.pathname === '/setup') {
    return (
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-50">
        <main className="flex-1 flex items-center justify-center p-4">
          <Outlet />
        </main>
      </div>
    );
  }

  const navItems = [
    { path: '/', name: '犯错记录', icon: <PenSquare size={20} /> },
    { path: '/teams', name: '队伍管理', icon: <Users size={20} /> },
    { path: '/bosses', name: '副本管理', icon: <Swords size={20} /> },
    { path: '/logs', name: '记录明细', icon: <FileText size={20} /> },
    { path: '/settings', name: '系统设置', icon: <Settings size={20} /> },
  ];
  const visibleNavItems = navItems;

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-50">
      <header className="bg-slate-800 border-b border-slate-700 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg tracking-wide text-blue-400">
            <span className="bg-blue-500/20 p-1.5 rounded-md">
              <PenSquare size={18} className="text-blue-400" />
            </span>
            FF14 Oopsie
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex flex-col items-end text-xs leading-4">
              <span className="text-slate-200 font-semibold">{session.workspaceName}</span>
              <span className="text-slate-400">
                {session.displayName} · {session.role} {session.inviteCode ? `· 工作区码 ${session.inviteCode}` : ''}
              </span>
            </div>
            <nav className="flex gap-1">
              {visibleNavItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="hidden sm:inline">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={() => {
                clearWorkspaceSession();
                window.location.reload();
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              title="切换工作区"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">切换</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 overflow-y-auto overflow-x-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
