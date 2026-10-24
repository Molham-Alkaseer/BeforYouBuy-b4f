import { useEffect, useState, useCallback, useContext, createContext } from "react";
import {
  getSessionState,
  subscribe,
  restoreSession,
  login,
  logout,
  register,
  SessionState,
  AuthStatus,
} from "./session-store";

interface SessionContextType extends SessionState {
  login: typeof login;
  logout: typeof logout;
  register: typeof register;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionState>(getSessionState());

  const handleStoreChange = useCallback(() => {
    setSession(getSessionState());
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe(handleStoreChange);
    restoreSession();
    return unsubscribe;
  }, []);

  const contextValue: SessionContextType = {
    status: session.status,
    user: session.user,
    login,
    logout,
    register,
  };

  return (
    <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export type { AuthStatus };
