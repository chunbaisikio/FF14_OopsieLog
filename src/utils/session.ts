export type WorkspaceRole = 'admin' | 'captain' | 'member';

export interface WorkspaceSession {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  displayName: string;
  passcode: string;
  role: WorkspaceRole;
  workspaceType: 'admin' | 'captain';
  inviteCode?: string;
}

const SESSION_STORAGE_KEY = 'ff14oopsie-team-session';

export function getWorkspaceSession(): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceSession;
  } catch (error) {
    console.error('Failed to read workspace session:', error);
    return null;
  }
}

export function setWorkspaceSession(session: WorkspaceSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearWorkspaceSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getWorkspaceScopedStorageKey(baseKey: string): string {
  const session = getWorkspaceSession();
  return session ? `${baseKey}:${session.workspaceId}` : baseKey;
}
