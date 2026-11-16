import type { Server } from "bun";

let server: Server<unknown> | null = null;

/** Set when the HTTP server starts (see index.ts); until then publishing is a no-op (e.g. in tests using app.handle). */
export const setRealtimeServer = (s: Server<unknown> | null) => {
  server = s;
};

/** Pushes an event to every open socket of the given users (each socket subscribes to `user:<id>` on connect). */
export function publishToUsers(userIds: number[], event: unknown) {
  if (!server) return;
  const data = JSON.stringify(event);
  for (const id of new Set(userIds)) server.publish(`user:${id}`, data);
}
