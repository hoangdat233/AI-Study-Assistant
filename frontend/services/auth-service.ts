import { apiGet, apiPost } from "@/lib/api-client";
import { LoginPayload, RegisterPayload, TokenResponse, User } from "@/types";

const TOKEN_KEY = "auth_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function registerUser(payload: RegisterPayload): Promise<User> {
  return apiPost<User, RegisterPayload>("/api/auth/register", payload);
}

export async function loginUser(payload: LoginPayload): Promise<TokenResponse> {
  const data = await apiPost<TokenResponse, LoginPayload>("/api/auth/login", payload);
  setToken(data.access_token);
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const token = getToken();
  if (!token) {
    throw new Error("No authentication token found");
  }
  return apiGet<User>("/api/auth/me", { token });
}
