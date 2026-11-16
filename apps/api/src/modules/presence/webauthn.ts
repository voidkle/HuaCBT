import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { webauthnCredentials } from "../../db/schema";

// The browser runs on the frontend origin, so that is the relying party (rpID = its host name, e.g. "localhost").
const origin = () => new URL(process.env.FRONTEND_URL!).origin;
const rpID = () => new URL(process.env.FRONTEND_URL!).hostname;

// ponytail: pending challenges live in memory (one ceremony per user, 5 minutes). A restart or a second API instance
// loses them, and the user just taps again. Move to a table or the signed cookie if the API is ever scaled out.
type Pending = { challenge: string; kind: "register" | "check-in"; sessionId: number | null; expires: number };
const pending = new Map<number, Pending>();
const TTL_MS = 5 * 60_000;

function remember(userId: number, kind: Pending["kind"], challenge: string, sessionId: number | null = null) {
  const now = Date.now();
  for (const [id, p] of pending) if (p.expires < now) pending.delete(id);
  pending.set(userId, { challenge, kind, sessionId, expires: now + TTL_MS });
}

/** A challenge is single use: taking it removes it, so a captured response can never be replayed. */
function take(userId: number, kind: Pending["kind"], sessionId: number | null = null): string | null {
  const p = pending.get(userId);
  pending.delete(userId);
  return p && p.kind === kind && p.sessionId === sessionId && p.expires >= Date.now() ? p.challenge : null;
}

export const listPasskeys = (userId: number) =>
  db
    .select({ id: webauthnCredentials.id, label: webauthnCredentials.label, createdAt: webauthnCredentials.createdAt, lastUsedAt: webauthnCredentials.lastUsedAt })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .orderBy(webauthnCredentials.createdAt);

const credentialsOf = (userId: number) => db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
export const hasPasskey = async (userId: number) => (await credentialsOf(userId)).length > 0;

export async function registrationOptions(user: { id: number; username: string; name: string }) {
  const existing = await credentialsOf(user.id);
  const options = await generateRegistrationOptions({
    rpName: "HuaEBL",
    rpID: rpID(),
    userName: user.username,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none", // we only need the public key, not proof of the device model
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: (c.transports ?? undefined) as never })),
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "preferred", userVerification: "required" }, // the phone's own fingerprint/face/PIN
  });
  remember(user.id, "register", options.challenge);
  return options;
}

export async function saveRegistration(userId: number, label: string, response: RegistrationResponseJSON): Promise<boolean> {
  const expectedChallenge = take(userId, "register");
  if (!expectedChallenge) return false;
  const v = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin(), expectedRPID: rpID(), requireUserVerification: true });
  if (!v.verified || !v.registrationInfo) return false;
  const { credential } = v.registrationInfo;
  await db.insert(webauthnCredentials).values({
    userId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter,
    transports: credential.transports ?? null,
    label,
  });
  return true;
}

export const deletePasskey = async (userId: number, id: number) =>
  (await db.delete(webauthnCredentials).where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, userId))).returning({ id: webauthnCredentials.id })).length > 0;

export async function checkInOptions(userId: number, sessionId: number) {
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "required",
    allowCredentials: (await credentialsOf(userId)).map((c) => ({ id: c.credentialId, transports: (c.transports ?? undefined) as never })),
  });
  remember(userId, "check-in", options.challenge, sessionId);
  return options;
}

/** True when the response is a valid biometric/PIN-verified signature from one of this user's passkeys. */
export async function verifyCheckIn(userId: number, sessionId: number, response: AuthenticationResponseJSON): Promise<boolean> {
  const expectedChallenge = take(userId, "check-in", sessionId);
  if (!expectedChallenge) return false;
  const [cred] = await db.select().from(webauthnCredentials).where(and(eq(webauthnCredentials.credentialId, response.id), eq(webauthnCredentials.userId, userId)));
  if (!cred) return false;
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
    requireUserVerification: true,
    credential: { id: cred.credentialId, publicKey: Buffer.from(cred.publicKey, "base64url"), counter: cred.counter, transports: (cred.transports ?? undefined) as never },
  });
  if (!v.verified) return false;
  await db.update(webauthnCredentials).set({ counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(webauthnCredentials.id, cred.id));
  return true;
}
