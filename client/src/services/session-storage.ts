const TOKEN_KEY = 'byb.accessToken';
export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const memory = new Map<string, string>();
const fallbackStorage: SessionStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value); },
  removeItem: key => { memory.delete(key); },
};
function browserStorage(): SessionStorage {
  try { return typeof sessionStorage === 'undefined' ? fallbackStorage : sessionStorage; }
  catch { return fallbackStorage; }
}
let storage = browserStorage();
let revision = 0;
const listeners = new Set<() => void>();
export function subscribeToken(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function changed() { revision++; listeners.forEach(listener => listener()); }
export function setSessionStorage(value: SessionStorage): void { storage = value; changed(); }
export function getAccessToken(): string | null { return storage.getItem(TOKEN_KEY); }
export function getTokenRevision(): number { return revision; }
export function setAccessToken(token: string): void { storage.setItem(TOKEN_KEY, token); changed(); }
export function clearAccessToken(): void { storage.removeItem(TOKEN_KEY); changed(); }
export function invalidateAccessToken(token: string | null, requestRevision: number): void {
  if (token && token === getAccessToken() && requestRevision === revision) clearAccessToken();
}
export function hasToken(): boolean { return getAccessToken() !== null; }
