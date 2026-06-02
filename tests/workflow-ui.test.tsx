import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

type MockSession = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  displayName: string;
  passcode: string;
  role: 'admin' | 'captain' | 'member';
  workspaceType: 'admin' | 'captain';
  inviteCode?: string;
} | null;

let mockSession: MockSession = null;
let mockStoreState = {
  bossProfiles: [] as Array<{
    id: string;
    name: string;
    parts: Array<{
      id: string;
      name: string;
      mechanics: Array<{ id: string; shortName: string; officialName: string }>;
    }>;
  }>,
  teams: [] as Array<{ id: string; name: string; bossId: string; captainUserId?: string }>,
  mistakes: [] as Array<{
    teamId: string;
    date: string;
    pullNumber: number;
    partId: string;
    mechanicId: string;
  }>,
  isHydrated: true
};

vi.mock('../src/utils/session', () => ({
  getWorkspaceSession: () => mockSession,
  setWorkspaceSession: vi.fn(),
  clearWorkspaceSession: vi.fn(),
  getWorkspaceScopedStorageKey: (baseKey: string) => (mockSession ? `${baseKey}:${mockSession.workspaceId}` : baseKey)
}));

vi.mock('../src/store', () => ({
  useAppStore: () => mockStoreState
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => <div data-testid="recharts-responsive">{children}</div>,
  BarChart: ({ children }: PropsWithChildren) => <div>{children}</div>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Bar: () => null
}));

import Layout from '../src/components/Layout';
import ProgressBoard from '../src/pages/ProgressBoard';
import WorkspaceGate from '../src/components/WorkspaceGate';

describe('workflow ui smoke tests', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      }
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true
    });

    mockSession = null;
    mockStoreState = {
      bossProfiles: [],
      teams: [],
      mistakes: [],
      isHydrated: true
    };
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  it('shows a human-readable startup hint when auth endpoint returns html', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!doctype html><html><body>fallback</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    );

    render(<WorkspaceGate />);

    expect(await screen.findByText(/返回了 HTML 页面而不是 JSON/)).toBeInTheDocument();
    expect(screen.getByText(/请优先使用 http:\/\/127\.0\.0\.1:3001/)).toBeInTheDocument();
  });

  it('only shows progress navigation for admins', async () => {
    mockStoreState = {
      bossProfiles: [{ id: 'boss-1', name: '绝神兵', parts: [] }],
      teams: [{ id: 'team-1', name: '一队', bossId: 'boss-1' }],
      mistakes: [],
      isHydrated: true
    };

    mockSession = {
      userId: 'admin-1',
      workspaceId: 'ws-1',
      workspaceName: '测试工作区',
      displayName: 'Admin',
      passcode: 'ADMIN-001',
      role: 'admin',
      workspaceType: 'admin'
    };

    const { rerender } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>home</div>} />
            <Route path="setup" element={<div>setup</div>} />
            <Route path="settings" element={<div>settings</div>} />
            <Route path="progress" element={<div>progress</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('进度总览')).toBeInTheDocument();

    mockSession = {
      userId: 'member-1',
      workspaceId: 'ws-1',
      workspaceName: '测试工作区',
      displayName: 'Member',
      passcode: 'MEMBER-001',
      role: 'member',
      workspaceType: 'captain'
    };

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<div>home</div>} />
            <Route path="setup" element={<div>setup</div>} />
            <Route path="settings" element={<div>settings</div>} />
            <Route path="progress" element={<div>progress</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByText('进度总览')).not.toBeInTheDocument();
    });
  });

  it('blocks non-admin users from progress board and renders comparison for admins', async () => {
    mockStoreState = {
      bossProfiles: [
        {
          id: 'boss-1',
          name: '绝亚历山大',
          parts: [
            {
              id: 'part-1',
              name: 'P1',
              mechanics: [{ id: 'mech-1', shortName: '审判', officialName: '审判结晶' }]
            }
          ]
        }
      ],
      teams: [
        { id: 'team-1', name: '一队', bossId: 'boss-1', captainUserId: 'captain-1' },
        { id: 'team-2', name: '二队', bossId: 'boss-1' }
      ],
      mistakes: [
        { teamId: 'team-1', date: '2026-06-01', pullNumber: 12, partId: 'part-1', mechanicId: 'mech-1' }
      ],
      isHydrated: true
    };

    mockSession = {
      userId: 'member-1',
      workspaceId: 'ws-1',
      workspaceName: '测试工作区',
      displayName: 'Member',
      passcode: 'MEMBER-001',
      role: 'member',
      workspaceType: 'captain'
    };

    const { rerender } = render(<ProgressBoard />);
    expect(screen.getByText('仅管理员可查看')).toBeInTheDocument();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          rows: [
            {
              workspaceId: 'ws-1',
              workspaceName: 'Captain 空间',
              captainName: 'Captain',
              bossId: 'boss-1',
              bossName: '绝亚历山大',
              teamId: 'team-1',
              teamName: '一队',
              currentPart: 'P1',
              currentMechanic: 'P1 / 审判',
              activeDays: 1,
              totalPulls: 12,
              progressScore: 1,
              partScore: 1
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    mockSession = {
      userId: 'admin-1',
      workspaceId: 'ws-1',
      workspaceName: '测试工作区',
      displayName: 'Admin',
      passcode: 'ADMIN-001',
      role: 'admin',
      workspaceType: 'admin'
    };

    rerender(<ProgressBoard />);
    expect(screen.getByText('横向进度比较')).toBeInTheDocument();
    expect(await screen.findByText('一队')).toBeInTheDocument();
  });
});
