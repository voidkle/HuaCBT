import { db } from "../../db";
import { users } from "../../db/schema";

const { TEKSSO_URL, TEKSSO_CLIENT_ID, TEKSSO_CLIENT_SECRET, APP_URL, FRONTEND_URL, BOOTSTRAP_ADMIN } = process.env;
const redirectUri = `${APP_URL}/auth/callback`;

export const newState = () => crypto.randomUUID();

/**
 * Without a client id TekSso answers with a confusing "unsupported_grant_type", so say what is missing instead.
 * Read at call time (not destructured above) so it reflects the real environment.
 */
export const ssoConfigProblem = () =>
  process.env.TEKSSO_CLIENT_ID && process.env.TEKSSO_CLIENT_SECRET
    ? null
    : "Login belum dikonfigurasi: isi TEKSSO_CLIENT_ID dan TEKSSO_CLIENT_SECRET di apps/api/.env (dari halaman Apps di TekSso, redirect URI APP_URL/auth/callback), lalu restart API.";

export const authorizeUrl = (state: string) =>
  `${TEKSSO_URL}/oauth/authorize?` +
  new URLSearchParams({ client_id: TEKSSO_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code", scope: "", state });

export const logoutUrl = () =>
  `${TEKSSO_URL}/oauth/logout?` +
  new URLSearchParams({ client_id: TEKSSO_CLIENT_ID!, post_logout_redirect_uri: `${APP_URL}/auth/logged-out` });

// Only redirect to paths on our own frontend (prevents open redirects via ?return_to=).
export const frontendUrl = (path?: string) => FRONTEND_URL!.replace(/\/$/, "") + (path && /^\/(?![/\\])/.test(path) ? path : "/");

interface SsoUser { id: number; username: string; first_name: string; last_name: string; email: string | null }

/** Exchanges the OAuth code for the TekSso user and upserts the local user (role is owned by this app). */
export async function userFromCode(code: string) {
  const tokenRes = await fetch(`${TEKSSO_URL}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: TEKSSO_CLIENT_ID!, client_secret: TEKSSO_CLIENT_SECRET!, redirect_uri: redirectUri, code }),
  });
  if (!tokenRes.ok) throw new Error(`TekSso token exchange failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const infoRes = await fetch(`${TEKSSO_URL}/api/sso/userinfo`, { headers: { authorization: `Bearer ${access_token}`, accept: "application/json" } });
  if (!infoRes.ok) throw new Error(`TekSso userinfo failed: ${infoRes.status}`);
  const info = (await infoRes.json()) as SsoUser;

  const profile = { username: info.username, name: `${info.first_name} ${info.last_name}`.trim(), email: info.email };
  const isBootstrapAdmin = !!BOOTSTRAP_ADMIN && info.username === BOOTSTRAP_ADMIN;
  const [user] = await db
    .insert(users)
    .values({ ssoId: info.id, ...profile, ...(isBootstrapAdmin && { role: "admin" as const }) }) // new users default to student
    .onConflictDoUpdate({ target: users.ssoId, set: { ...profile, ...(isBootstrapAdmin && { role: "admin" as const }) } })
    .returning();
  return user!;
}
