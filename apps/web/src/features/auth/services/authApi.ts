import { API_URL, api } from "@/services/api";
import type { AuthUser } from "../types";

/** The signed-in user, or null when there is no (valid) session. */
export async function fetchMe(): Promise<AuthUser | null> {
  const { data, error } = await api.auth.me.get();
  if (error || !data) return null;
  return data as AuthUser;
}

// Login/logout are full-page redirects through the API (it talks to TekSso and sets the session cookie).
export const loginUrl = (returnTo = "/") => `${API_URL}/auth/login?return_to=${encodeURIComponent(returnTo)}`;
export const logoutUrl = () => `${API_URL}/auth/logout`;
