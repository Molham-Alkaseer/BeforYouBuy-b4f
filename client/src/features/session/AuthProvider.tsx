import { useEffect, useSyncExternalStore } from 'react';
import { getSessionState, subscribe, restoreSession, login, logout } from './session-store';
import { SessionContext } from './session-context';
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(subscribe, getSessionState);
  useEffect(() => { void restoreSession(); }, []);
  return <SessionContext.Provider value={{ ...session, login, logout }}>
    {session.error && <div className="byb-message byb-error" role="alert">
      {session.error} <button type="button" onClick={() => void restoreSession()}>Retry session</button>
    </div>}
    {children}
  </SessionContext.Provider>;
}
