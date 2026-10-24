import { ApiError } from "./types";
import { getAccessToken } from "./services/session-storage";

const rawApiUrl = import.meta.env.VITE_API_URL || "/api";
export const API_URL = rawApiUrl.endsWith("/")
  ? rawApiUrl.slice(0, -1)
  : rawApiUrl;

export function getAuthHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(options?.headers);

  if (options?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${normalizedPath}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError({
      statusCode: 0,
      code: "NETWORK_ERROR",
      message:
        "Unable to reach the server. Please check your connection and try again.",
      fieldErrors: {},
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const rawMessage = body?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(", ")
      : typeof rawMessage === "string" && rawMessage.trim() !== ""
        ? rawMessage
        : `Request failed (${response.status})`;

    throw new ApiError({
      statusCode:
        typeof body?.statusCode === "number"
          ? body.statusCode
          : response.status,
      code: typeof body?.code === "string" ? body.code : "INTERNAL_ERROR",
      message,
      fieldErrors:
        body?.fieldErrors && typeof body.fieldErrors === "object"
          ? body.fieldErrors
          : {},
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export { ApiError } from "./types";
export type { ApiClient, ApiErrorBody } from "./types";
export type {
  SafeUser,
  HouseholdRole,
  RegisterInput,
  LoginInput,
  LoginResult,
  AuthClient,
} from "./types";
export { authApi } from "./services/auth-api";
export { api, isMockMode } from "./services/api-client";
