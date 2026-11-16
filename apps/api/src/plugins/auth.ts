import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../db";
import { type Role, users } from "../db/schema";

export const SESSION_COOKIE = "hua_session";
export const STATE_COOKIE = "hua_sso_state";
export const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.APP_URL!.startsWith("https"), path: "/" } as const;

/**
 * Route option `role: true` (any signed-in user) or `role: ["admin", "operator"]`.
 * Loads the user from the DB on every request so role changes apply immediately; gives the handler a non-null `user`.
 */
export const authPlugin = new Elysia({ name: "auth" }).macro({
  role: (allowed: true | readonly Role[]) => ({
    async resolve({ cookie, status }) {
      const id = (cookie[SESSION_COOKIE]?.value as { id?: number } | undefined)?.id;
      const [user] = id ? await db.select().from(users).where(eq(users.id, id)) : [];
      if (!user) throw status(401, { message: "Unauthenticated" });
      if (allowed !== true && !allowed.includes(user.role)) throw status(403, { message: "Forbidden" });
      return { user };
    },
  }),
});
