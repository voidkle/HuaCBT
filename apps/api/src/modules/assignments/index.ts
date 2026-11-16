import { Elysia, t } from "elysia";
import { serveFile } from "../../http/serveFile";
import { authPlugin } from "../../plugins/auth";
import {
  addAssignmentFiles,
  ASSIGNEES,
  createAssignment,
  deleteAssignment,
  downloadable,
  getAssignment,
  getSubmission,
  grade,
  listAssignments,
  MANAGERS,
  removeAssignmentFile,
  reopen,
  roster,
  submit,
  targets,
  updateAssignment,
} from "./service";

const text = (max: number) => t.String({ minLength: 1, maxLength: max, pattern: "\\S" });
const fields = {
  title: text(120),
  instructions: t.Optional(t.String({ maxLength: 5000 })),
  dueAt: t.String({ maxLength: 40 }), // ISO date-time
  allowLate: t.Optional(t.Boolean()),
  maxPoints: t.Optional(t.Integer({ minimum: 1, maximum: 1000 })),
};

// ponytail: ids are parsed by hand (see presence): Elysia 1.4.32 breaks `t.Numeric()` params on Bun's frozen params
const idOf = (raw: string) => (/^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const missing = { message: "Tidak ditemukan" };
const date = (iso: string) => (Number.isNaN(Date.parse(iso)) ? null : new Date(iso));
/** Multipart gives one File or an array, depending on how many were sent. */
const asFiles = (v: File | File[] | undefined): File[] => (Array.isArray(v) ? v : v ? [v] : []);
const bad = { message: "Tanggal tidak valid" };

export const assignmentsModule = new Elysia({ prefix: "/assignments" })
  .use(authPlugin)
  .get("/targets", ({ user }) => targets(user), { role: MANAGERS })
  .get("/", ({ user, query }) => listAssignments(user, query.classroomId && /^\d{1,15}$/.test(query.classroomId) ? Number(query.classroomId) : undefined), { role: ASSIGNEES, query: t.Object({ classroomId: t.Optional(t.String()) }) })
  .post(
    "/",
    async ({ user, body, status }) => {
      const dueAt = date(body.dueAt);
      if (!dueAt) return status(422, bad);
      const r = await createAssignment(user, { ...body, instructions: body.instructions ?? "", dueAt, allowLate: body.allowLate ?? true, maxPoints: body.maxPoints ?? 100 });
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: MANAGERS, body: t.Object({ ...fields, classroomId: t.Integer({ minimum: 1 }), subjectId: t.Integer({ minimum: 1 }) }) },
  )
  // ----- files (static paths first) -----
  .get(
    "/files/:fileId",
    async ({ user, params, request, status }) => {
      const id = idOf(params.fileId);
      if (!id) return status(404, missing);
      const r = await downloadable(user, id);
      if (!r.ok) return status(r.code, { message: r.message });
      return serveFile(r.value.file, request.headers.get("range"), {
        "content-type": "application/octet-stream", // never rendered in the page: always a download
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.value.name)}`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      });
    },
    { role: ASSIGNEES },
  )
  // ----- grading -----
  .get(
    "/submissions/:sid",
    async ({ user, params, status }) => {
      const id = idOf(params.sid);
      if (!id) return status(404, missing);
      const r = await getSubmission(user, id);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  .put(
    "/submissions/:sid/grade",
    async ({ user, params, body, status }) => {
      const id = idOf(params.sid);
      if (!id) return status(404, missing);
      const r = await grade(user, id, { score: body.score, feedback: body.feedback ?? "" });
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS, body: t.Object({ score: t.Number({ minimum: 0, maximum: 1000 }), feedback: t.Optional(t.String({ maxLength: 2000 })) }) },
  )
  .delete(
    "/submissions/:sid/grade",
    async ({ user, params, status }) => {
      const id = idOf(params.sid);
      if (!id) return status(404, missing);
      const r = await reopen(user, id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  // ----- one assignment -----
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await getAssignment(user, id);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: ASSIGNEES },
  )
  .patch(
    "/:id",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      const dueAt = date(body.dueAt);
      if (!id) return status(404, missing);
      if (!dueAt) return status(422, bad);
      const r = await updateAssignment(user, id, { ...body, instructions: body.instructions ?? "", dueAt, allowLate: body.allowLate ?? true, maxPoints: body.maxPoints ?? 100 });
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: MANAGERS, body: t.Object(fields) },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await deleteAssignment(user, id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  .post(
    "/:id/files",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await addAssignmentFiles(user, id, asFiles(body.files));
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS, body: t.Object({ files: t.Files() }) },
  )
  .delete(
    "/:id/files/:fileId",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      const fileId = idOf(params.fileId);
      if (!id || !fileId) return status(404, missing);
      const r = await removeAssignmentFile(user, id, fileId);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  .get(
    "/:id/submissions",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await roster(user, id);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: MANAGERS },
  )
  .put(
    "/:id/submission",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const keep = (body.keep ?? "").split(",").filter((x) => /^\d{1,15}$/.test(x)).map(Number);
      const r = await submit(user, id, { text: body.text ?? "", keep, files: asFiles(body.files) });
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: ["student"], body: t.Object({ text: t.Optional(t.String({ maxLength: 12000 })), keep: t.Optional(t.String({ maxLength: 200 })), files: t.Optional(t.Files()) }) },
  );
