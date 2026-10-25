import { ApiError } from '../types';
import { getAccessToken, getTokenRevision, invalidateAccessToken } from './session-storage';

export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  const method = (options?.method ?? 'GET').toUpperCase();
  const publicAuth = normalizedPath === '/auth/login' || normalizedPath === '/auth/register';
  const protectedRequest = !publicAuth && (normalizedPath === '/auth/me' || !['GET', 'HEAD'].includes(method));
  let token = protectedRequest ? getAccessToken() : null;
  const tokenRevision = getTokenRevision();
  // Fixture tokens must never be sent to the real backend.
  if (token?.startsWith('mock-token-')) { invalidateAccessToken(token, tokenRevision); token = null; }
  const headers = new Headers(options?.headers);
  headers.delete('Authorization');
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (options?.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(API_URL + normalizedPath, { ...options, headers }); }
  catch { throw new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'Unable to reach the server. Please check your connection and try again.', fieldErrors: {} }); }
  if (!response.ok) {
    if (response.status === 401 && protectedRequest) invalidateAccessToken(token, tokenRevision);
    const body = await response.json().catch(() => null);
    const rawMessage = body?.message;
    throw new ApiError({
      statusCode: response.status,
      code: typeof body?.code === 'string' ? body.code : 'HTTP_ERROR',
      message: Array.isArray(rawMessage) ? rawMessage.join(', ') : typeof rawMessage === 'string' && rawMessage.trim() ? rawMessage : 'Request failed (' + response.status + ')',
      fieldErrors: body?.fieldErrors && typeof body.fieldErrors === 'object' ? body.fieldErrors : {},
    });
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
