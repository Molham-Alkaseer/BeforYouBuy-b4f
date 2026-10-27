import { authApi } from '../../services/auth-api';
import { clearAccessToken, getAccessToken, setAccessToken, subscribeToken } from '../../services/session-storage';
import { ApiError, type LoginInput, type RegisterInput, type SafeUser } from '../../types';

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';
export interface SessionState { status: AuthStatus; user: SafeUser | null; error: string | null }
let state: SessionState = { status: getAccessToken() ? 'checking' : 'anonymous', user: null, error: null };
let epoch = 0;
const listeners = new Set<() => void>();
function update(next: SessionState) { state = next; listeners.forEach(listener => listener()); }
export function getSessionState(): SessionState { return state; }
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
subscribeToken(() => {
  if (!getAccessToken()) { epoch++; update({ status: 'anonymous', user: null, error: null }); }
});

export async function restoreSession(): Promise<void> {
  const run = ++epoch;
  const token = getAccessToken();
  if (!token) { update({ status: 'anonymous', user: null, error: null }); return; }
  update({ status: 'checking', user: null, error: null });
  try {
    const user = await authApi.me();
    if (run === epoch && token === getAccessToken()) update({ status: 'authenticated', user, error: null });
  } catch (error) {
    if (run !== epoch || token !== getAccessToken()) return;
    if (error instanceof ApiError && error.statusCode === 401) { clearAccessToken(); return; }
    update({ status: 'anonymous', user: null, error: error instanceof Error ? error.message : 'Could not check your session.' });
  }
}
export async function login(input: LoginInput): Promise<void> {
  const run = ++epoch;
  const result = await authApi.login(input);
  if (run !== epoch) throw new ApiError({ statusCode: 0, code: 'SESSION_CHANGED', message: 'The session changed. Please sign in again.', fieldErrors: {} });
  setAccessToken(result.accessToken);
  update({ status: 'authenticated', user: result.user, error: null });
}
export function logout(): void { epoch++; clearAccessToken(); }
export async function register(input: RegisterInput): Promise<void> {
  const run = ++epoch;
  await authApi.register(input);
  if (run !== epoch) throw new ApiError({ statusCode: 0, code: 'SESSION_CHANGED', message: 'The session changed. Please sign in again.', fieldErrors: {} });
  try {
    await login({ email: input.email, password: input.password });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'SESSION_CHANGED') throw error;
    throw new ApiError({
      statusCode: error instanceof ApiError ? error.statusCode : 0,
      code: 'REGISTRATION_LOGIN_FAILED',
      message: 'Your account was created, but automatic sign-in failed. Please use the Sign in link below to access your account.',
      fieldErrors: {},
    });
  }
}
