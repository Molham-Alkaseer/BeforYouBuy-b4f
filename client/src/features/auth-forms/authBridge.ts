import { createApiError } from '../items/apiError';

// TEMPORARY bridge. Everything that must come from the shared session files
// (useAuth, authApi, sanitizeReturnTo) is gathered here, so connecting the
// real ones later means editing only this file.

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

export const FALLBACK_RETURN_TO = '/pantry';

// TODO: replace with Rami's sanitizeReturnTo from features/navigation/returnTo.ts.
// Only paths inside this app are allowed, and never the auth pages themselves.
export function sanitizeReturnTo(value: string | null): string {
  if (
    value === null ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32) ||
    value === '/login' ||
    value.startsWith('/login?') ||
    value === '/register' ||
    value.startsWith('/register?')
  ) {
    return FALLBACK_RETURN_TO;
  }
  return value;
}

// Builds /login or /register and keeps a safe returnTo in the address.
export function authPath(base: '/login' | '/register', returnTo: string): string {
  return returnTo === FALLBACK_RETURN_TO
    ? base
    : `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

function notConnected(): never {
  throw createApiError({
    statusCode: 0,
    code: 'AUTH_NOT_CONNECTED',
    message: 'Sign-in is not connected to the server yet.',
    fieldErrors: {},
  });
}

// TODO: replace with useAuth().status.
export function useAuthStatus(): AuthStatus {
  return 'anonymous';
}

// TODO: replace with useAuth().login(input).
export async function loginAction(): Promise<void> {
  notConnected();
}

// TODO: replace with authApi.register(input) from services/api-client.ts.
export async function registerAction(): Promise<unknown> {
  notConnected();
}