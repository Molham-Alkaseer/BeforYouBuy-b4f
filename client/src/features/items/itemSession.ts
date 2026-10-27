import { useAuthRole, useAuthStatus } from '../auth-forms/authBridge';
import type { AuthRole, AuthStatus } from '../auth-forms/authBridge';

export interface ItemSession {
  status: AuthStatus;
  role: AuthRole | null;
}

// The only place the item screens read the session from.
export function useItemSession(): ItemSession {
  const status = useAuthStatus();
  const role = useAuthRole();
  return { status, role };
}

// Family members can read; only admins manage stock.
export function canWriteItems(session: ItemSession): boolean {
  return canDeleteItems(session);
}

// Delete: admin and owner only. The server still checks it too.
export function canDeleteItems(session: ItemSession): boolean {
  return (
    session.status === 'authenticated' &&
    (session.role === 'admin' || session.role === 'owner')
  );
}
