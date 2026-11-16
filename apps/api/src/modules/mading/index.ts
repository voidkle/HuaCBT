import { Elysia, t } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { createNotice, deleteNotice, listNotices, REVIEWERS, reviewNotice, updateNotice } from "./service";

const text = (max: number) => t.String({ minLength: 1, maxLength: max, pattern: "\\S" }); // at least one non-space char
const noticeBody = t.Object({ title: text(120), body: text(2000) });

// ponytail: no `params: t.Object({ id: t.Numeric() })` schema: on a real Bun server Elysia 1.4.32 throws 500 while coercing
// Bun's frozen params object (app.handle() hides this). Parse the id by hand until that is fixed upstream.
const idOf = (raw: string) => (/^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const badId = { message: "Pengumuman tidak ditemukan" };

export const madingModule = new Elysia({ prefix: "/mading" })
  .use(authPlugin)
  .get("/", ({ user }) => listNotices(user), { role: true })
  .post("/", ({ user, body }) => createNotice(user, body), { role: true, body: noticeBody })
  .patch(
    "/:id",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, badId);
      const r = await updateNotice(user, id, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: true, body: noticeBody },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, badId);
      const r = await deleteNotice(user, id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: true },
  )
  .post(
    "/:id/approve",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, badId);
      const r = await reviewNotice(user, id, "approved");
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: REVIEWERS },
  )
  .post(
    "/:id/reject",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, badId);
      const r = await reviewNotice(user, id, "rejected", body?.note);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: REVIEWERS, body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 300 })) })) },
  );
