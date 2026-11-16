import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { Elysia, t } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { getSettings } from "../config/service";
import {
  closeSession,
  createClassroom,
  deleteClassroom,
  deleteSession,
  finishCheckIn,
  getClassroom,
  getSession,
  listClassrooms,
  listSessions,
  MANAGERS,
  openForMe,
  openSession,
  PARTICIPANTS,
  searchPeople,
  startCheckIn,
  updateClassroom,
} from "./service";
import { deletePasskey, listPasskeys, registrationOptions, saveRegistration } from "./webauthn";

const text = (max: number) => t.String({ minLength: 1, maxLength: max, pattern: "\\S" });
const classroomBody = t.Object({ name: text(80), memberIds: t.Array(t.Integer({ minimum: 1 }), { maxItems: 500 }) });
const sessionBody = t.Object({ title: text(120), durationMinutes: t.Optional(t.Integer({ minimum: 1, maximum: 1440 })), lateAfterMinutes: t.Optional(t.Integer({ minimum: 1, maximum: 1440 })) });
const where = { lat: t.Optional(t.Nullable(t.Number({ minimum: -90, maximum: 90 }))), lng: t.Optional(t.Nullable(t.Number({ minimum: -180, maximum: 180 }))) };

// ponytail: no `params: t.Object({ id: t.Numeric() })` (see mading): Elysia 1.4.32 breaks on Bun's frozen params, so ids are parsed by hand
const idOf = (raw: string) => (/^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const missing = { message: "Tidak ditemukan" };

export const presenceModule = new Elysia({ prefix: "/presence" })
  .use(authPlugin)
  // ----- passkeys: a person's own devices -----
  .get("/passkeys", ({ user }) => listPasskeys(user.id), { role: PARTICIPANTS })
  .post(
    "/passkeys/options",
    async ({ user, status }) => ((await getSettings()).biometricsEnabled ? registrationOptions(user) : status(403, { message: "Presensi biometrik dinonaktifkan oleh admin" })),
    { role: PARTICIPANTS },
  )
  .post(
    "/passkeys",
    async ({ user, body, status }) => {
      if (!(await getSettings()).biometricsEnabled) return status(403, { message: "Presensi biometrik dinonaktifkan oleh admin" });
      let saved = false;
      try {
        saved = await saveRegistration(user.id, body.label.trim(), body.response as RegistrationResponseJSON);
      } catch {
        saved = false; // malformed or tampered response, or this device is already registered (unique credential id)
      }
      return saved ? { ok: true } : status(400, { message: "Pendaftaran perangkat gagal. Coba lagi." });
    },
    { role: PARTICIPANTS, body: t.Object({ label: text(60), response: t.Any() }) },
  )
  .delete(
    "/passkeys/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      return id && (await deletePasskey(user.id, id)) ? { ok: true } : status(404, missing);
    },
    { role: PARTICIPANTS },
  )
  // ----- classrooms (managers; members see their own) -----
  .get("/people", ({ query }) => searchPeople((query.q ?? "").trim()), { role: MANAGERS, query: t.Object({ q: t.Optional(t.String({ maxLength: 60 })) }) })
  .get("/classrooms", ({ user }) => listClassrooms(user), { role: PARTICIPANTS })
  .post(
    "/classrooms",
    async ({ user, body, status }) => {
      const r = await createClassroom(user, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: MANAGERS, body: classroomBody },
  )
  .get(
    "/classrooms/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await getClassroom(user, id);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: PARTICIPANTS },
  )
  .patch(
    "/classrooms/:id",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await updateClassroom(user, id, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: MANAGERS, body: classroomBody },
  )
  .delete(
    "/classrooms/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await deleteClassroom(user, id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  // ----- sessions -----
  .get(
    "/classrooms/:id/sessions",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await listSessions(user, id);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: PARTICIPANTS },
  )
  .post(
    "/classrooms/:id/sessions",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await openSession(user, id, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: MANAGERS, body: sessionBody },
  )
  .get("/sessions/open", ({ user }) => openForMe(user), { role: PARTICIPANTS })
  .get(
    "/sessions/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await getSession(user, id);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: PARTICIPANTS },
  )
  .post(
    "/sessions/:id/close",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await closeSession(user, id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  .delete(
    "/sessions/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await deleteSession(user, id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  // ----- check-in: options first (challenge), then the signed answer -----
  .post(
    "/sessions/:id/check-in/options",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await startCheckIn(user, id, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: PARTICIPANTS, body: t.Object(where) },
  )
  .post(
    "/sessions/:id/check-in",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await finishCheckIn(user, id, body, body.response as AuthenticationResponseJSON);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: PARTICIPANTS, body: t.Object({ ...where, response: t.Any() }) },
  );
