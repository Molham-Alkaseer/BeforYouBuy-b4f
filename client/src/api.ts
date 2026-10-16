// Use the Vite proxy locally. Never put the internal-tool key in frontend code.
const API_URL = import.meta.env.VITE_API_URL || '/api';
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
 const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
 if (!response.ok) {
  const body = await response.json().catch(() => null);
  const message = body?.message;
  throw new Error(Array.isArray(message) ? message.join(', ') : message || `Request failed (${response.status})`);
 }
 if (response.status === 204) return undefined as T;
 return response.json() as Promise<T>;
}
