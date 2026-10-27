import { useAuth } from '../session/useAuth';
import { login, register } from '../session/session-store';
export { sanitizeReturnTo } from '../navigation/returnTo';
export type { AuthStatus } from '../session/session-store';
export type { HouseholdRole as AuthRole } from '../../types';
export const FALLBACK_RETURN_TO = '/pantry';
export function authPath(base: '/login' | '/register', returnTo: string): string {
  return returnTo === FALLBACK_RETURN_TO ? base : base + '?returnTo=' + encodeURIComponent(returnTo);
}
export function useAuthStatus() { return useAuth().status; }
export function useAuthRole() { return useAuth().user?.householdRole ?? null; }
export const loginAction = login;
export const registerAction = register;
