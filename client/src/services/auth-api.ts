import { request } from "../api";
import {
  LoginInput,
  LoginResult,
  RegisterInput,
  SafeUser,
} from "../types";

export const authApi = {
  async register(input: RegisterInput): Promise<SafeUser> {
    return request<SafeUser>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async login(input: LoginInput): Promise<LoginResult> {
    return request<LoginResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async me(): Promise<SafeUser> {
    return request<SafeUser>("/auth/me");
  },
};
