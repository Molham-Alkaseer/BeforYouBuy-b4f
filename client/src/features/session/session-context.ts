import { createContext } from 'react';
import type { SessionState, login, logout } from './session-store';
export const SessionContext = createContext<(SessionState & { login: typeof login; logout: typeof logout }) | null>(null);
