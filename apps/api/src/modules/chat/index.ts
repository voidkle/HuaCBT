import { Elysia, t } from "elysia";
import { serveFile } from "../../http/serveFile";
import { authPlugin } from "../../plugins/auth";
import { attachmentFile, createGroup, deleteMessage, linkables, listMessages, listRooms, markRead, messageFile, openDirectRoom, searchUsers, sendMessage } from "./service";

// ponytail: no `params`/`query` schemas (Elysia 1.4.32 + Bun frozen objects -> 500 on a real server); parse by hand
const idOf = (raw: string | undefined) => (raw && /^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const notFound = { message: "Tidak ditemukan" };

const send = t.Object({
  text: t.Optional(t.String({ maxLength: 2000 })),
  file: t.Optional(t.File()), // size is checked against the configurable "max chat media" in the service
  linkType: t.Optional(t.Union([t.Literal("ebook"), t.Literal("video"), t.Literal("slide")])),
  linkRef: t.Optional(t.Numeric()),
  linkPage: t.Optional(t.Numeric()),
});

const createRoom = t.Union([
  t.Object({ type: t.Literal("direct"), userId: t.Integer() }),
  t.Object({ type: t.Literal("group"), name: t.String({ minLength: 1, maxLength: 80, pattern: "\\S" }), memberIds: t.Array(t.Integer(), { minItems: 1, maxItems: 100 }) }),
]);

export const chatModule = new Elysia({ prefix: "/chat" })
  .use(authPlugin)
  .get("/rooms", ({ user }) => listRooms(user.id), { role: true })
  .post(
    "/rooms",
    async ({ user, body, status }) => {
      const r = body.type === "direct" ? await openDirectRoom(user, body.userId) : await createGroup(user, body.name, body.memberIds);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: true, body: createRoom },
  )
  .get(
    "/rooms/:id/messages",
    async ({ user, params, query, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, notFound);
      const before = idOf(query.before);
      const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
      const r = await listMessages(user, id, { before: before ?? undefined, limit });
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: true },
  )
  .post(
    "/rooms/:id/messages",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, notFound);
      const link = body.linkType && body.linkRef ? { type: body.linkType, ref: body.linkRef, page: body.linkPage ?? 1 } : undefined;
      const r = await sendMessage(user, id, { text: body.text ?? "", file: body.file, link });
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: true, body: send },
  )
  .post(
    "/rooms/:id/read",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      const r = id ? await markRead(user, id) : null;
      return r?.ok ? { ok: true } : status(r?.code ?? 404, { message: r?.message ?? notFound.message });
    },
    { role: true },
  )
  .delete(
    "/messages/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      const r = id ? await deleteMessage(user, id) : null;
      return r?.ok ? { ok: true } : status(r?.code ?? 404, { message: r?.message ?? notFound.message });
    },
    { role: true },
  )
  .get(
    "/messages/:id/file",
    async ({ user, params, request, status }) => {
      const id = idOf(params.id);
      const r = id ? await messageFile(user, id) : null;
      if (!r?.ok) return status(r?.code ?? 404, { message: r?.message ?? notFound.message });
      const { file, kind, mime, name } = r.value;
      const inline = kind !== "file"; // browser-native media is shown in the page; anything else is only ever downloaded
      return serveFile(file, request.headers.get("range"), {
        "content-type": inline ? mime : "application/octet-stream",
        "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      });
    },
    { role: true },
  )
  .get("/users", ({ user, query }) => searchUsers(user.id, query.q ?? ""), { role: true })
  .get("/linkables", () => linkables(), { role: true })
  // Live events: each socket joins `user:<id>`; the service publishes message/deleted/room events to member topics.
  .ws("/ws", {
    role: true,
    // Browsers always send Origin on a WebSocket handshake: refuse other sites (cross-site WebSocket hijacking).
    beforeHandle({ headers, status }) {
      const origin = headers.origin;
      if (origin && origin !== new URL(process.env.FRONTEND_URL!).origin) return status(403, { message: "Origin tidak diizinkan" });
    },
    open(ws) {
      ws.subscribe(`user:${ws.data.user.id}`);
    },
    message(ws, message) {
      if (message === "ping") ws.send("pong"); // client heartbeat keeps idle proxies from closing the socket
    },
  });
