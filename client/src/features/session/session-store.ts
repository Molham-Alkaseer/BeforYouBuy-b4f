import { authApi } from "../../services/auth-api";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../../services/session-storage";
import { LoginInput, RegisterInput, SafeUser } from "../../types";

export type AuthStatus = "checking" | "anonymous" | "authenticated";

export interface SessionState {
  status: AuthStatus;
  user: SafeUser | null;
}

export interface SessionActions {
  login: (input: LoginInput) => Promise<SafeUser>;
  logout: () => void;
  register: (input: RegisterInput) => Promise<SafeUser>;
  restoreSession: () => Promise<void>;
}

export interface SessionStore extends SessionState, SessionActions {}

const initialState: SessionState = {
  status: "checking",
  user: null,
};

let state: SessionState = { ...initialState };
let listeners: Array<() => void> = [];

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function getSessionState(): SessionState {
  return { ...state };
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export async function restoreSession(): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    state = { status: "anonymous", user: null };
    notify();
    return;
  }

  state = { status: "checking", user: null };
  notify();

  try {
    const user = await authApi.me();
    setAccessToken(token);
    state = { status: "authenticated", user };
  } catch {
    clearAccessToken();
    state = { status: "anonymous", user: null };
  }
  notify();
}

export async function login(input: LoginInput): Promise<SafeUser> {
  const result = await authApi.login(input);
  setAccessToken(result.token);
  state = { status: "authenticated", user: result.user };
  notify();
  return result.user;
}

export function logout(): void {
  clearAccessToken();
  state = { status: "anonymous", user: null };
  notify();
}

export async function register(input: RegisterInput): Promise<SafeUser> {
  const user = await authApi.register(input);
  return user;
}
