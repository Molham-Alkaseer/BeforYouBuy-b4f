const TOKEN_KEY = "byb.accessToken";

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const browserStorage: SessionStorage = {
  getItem(key: string): string | null {
    return typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(key)
      : null;
  },
  setItem(key: string, value: string): void {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem(key: string): void {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(key);
    }
  },
};

let currentStorage: SessionStorage = browserStorage;

export function setSessionStorage(storage: SessionStorage): void {
  currentStorage = storage;
}

export function getAccessToken(): string | null {
  return currentStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  currentStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  currentStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return getAccessToken() !== null;
}
