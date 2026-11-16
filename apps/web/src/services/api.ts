import { treaty } from "@elysia/eden";
import type { App } from "@hua/api";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Single typed API client (Eden Treaty); `include` sends the TekSso-backed session cookie.
export const api = treaty<App>(API_URL, { fetch: { credentials: "include" } });
