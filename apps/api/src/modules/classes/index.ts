import { Elysia, t } from "elysia";
import { authPlugin } from "../../plugins/auth";
import {
  addLesson,
  assignSubject,
  createClass,
  deleteRoom,
  deleteSubject,
  getClass,
  listClasses,
  listRooms,
  listSubjects,
  listTeachers,
  mySchedule,
  removeLesson,
  saveRoom,
  saveSubject,
  STRUCTURE,
  unassignSubject,
  updateClass,
  updateLesson,
} from "./service";

const text = (max: number) => t.String({ minLength: 1, maxLength: max, pattern: "\\S" });
const classBody = t.Object({ name: text(80), grade: t.Optional(t.Nullable(t.String({ maxLength: 20 }))), homeroomTeacherId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))) });
const lessonBody = t.Object({ weekday: t.Integer({ minimum: 1, maximum: 7 }), startMin: t.Integer({ minimum: 0, maximum: 1439 }), endMin: t.Integer({ minimum: 1, maximum: 1440 }), roomId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))) });

// ponytail: ids are parsed by hand (see presence): Elysia 1.4.32 breaks `t.Numeric()` params on Bun's frozen params
const idOf = (raw: string) => (/^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const missing = { message: "Tidak ditemukan" };

export const classesModule = new Elysia({ prefix: "/classes" })
  .use(authPlugin)
  // ----- catalog (everyone reads; the school office writes) -----
  .get("/teachers", () => listTeachers(), { role: STRUCTURE })
  .get("/subjects", () => listSubjects(), { role: true })
  .post("/subjects", async ({ body, status }) => { const r = await saveSubject(null, body.name); return r.ok ? r.value : status(r.code, { message: r.message }); }, { role: STRUCTURE, body: t.Object({ name: text(80) }) })
  .patch(
    "/subjects/:id",
    async ({ params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await saveSubject(id, body.name);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: STRUCTURE, body: t.Object({ name: text(80) }) },
  )
  .delete(
    "/subjects/:id",
    async ({ params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await deleteSubject(id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: STRUCTURE },
  )
  .get("/rooms", () => listRooms(), { role: true })
  .post("/rooms", async ({ body, status }) => { const r = await saveRoom(null, body); return r.ok ? r.value : status(r.code, { message: r.message }); }, { role: STRUCTURE, body: t.Object({ name: text(80), ownerId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))) }) })
  .patch(
    "/rooms/:id",
    async ({ params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await saveRoom(id, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: STRUCTURE, body: t.Object({ name: text(80), ownerId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))) }) },
  )
  .delete(
    "/rooms/:id",
    async ({ params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await deleteRoom(id);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: STRUCTURE },
  )
  // ----- my schedule -----
  .get("/schedule/mine", ({ user }) => mySchedule(user), { role: true })
  // ----- classes -----
  .get("/", ({ user }) => listClasses(user), { role: true })
  .post("/", async ({ user, body, status }) => { const r = await createClass(user, body); return r.ok ? r.value : status(r.code, { message: r.message }); }, { role: STRUCTURE, body: classBody })
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await getClass(user, id);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: true },
  )
  .patch(
    "/:id",
    async ({ params, body, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, missing);
      const r = await updateClass(id, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: STRUCTURE, body: classBody },
  )
  // ----- who teaches what -----
  .put(
    "/:id/subjects/:subjectId",
    async ({ params, body, status }) => {
      const id = idOf(params.id);
      const subjectId = idOf(params.subjectId);
      if (!id || !subjectId) return status(404, missing);
      const r = await assignSubject(id, subjectId, body.teacherId ?? null);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: STRUCTURE, body: t.Object({ teacherId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))) }) },
  )
  .delete(
    "/:id/subjects/:subjectId",
    async ({ params, status }) => {
      const id = idOf(params.id);
      const subjectId = idOf(params.subjectId);
      if (!id || !subjectId) return status(404, missing);
      const r = await unassignSubject(id, subjectId);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: STRUCTURE },
  )
  // ----- timetable -----
  .post(
    "/:id/subjects/:subjectId/lessons",
    async ({ params, body, status }) => {
      const id = idOf(params.id);
      const subjectId = idOf(params.subjectId);
      if (!id || !subjectId) return status(404, missing);
      const r = await addLesson(id, subjectId, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: STRUCTURE, body: lessonBody },
  )
  .patch(
    "/:id/lessons/:lessonId",
    async ({ params, body, status }) => {
      const id = idOf(params.id);
      const lessonId = idOf(params.lessonId);
      if (!id || !lessonId) return status(404, missing);
      const r = await updateLesson(id, lessonId, body);
      return r.ok ? r.value : status(r.code, { message: r.message });
    },
    { role: STRUCTURE, body: lessonBody },
  )
  .delete(
    "/:id/lessons/:lessonId",
    async ({ params, status }) => {
      const id = idOf(params.id);
      const lessonId = idOf(params.lessonId);
      if (!id || !lessonId) return status(404, missing);
      const r = await removeLesson(id, lessonId);
      return r.ok ? { ok: true } : status(r.code, { message: r.message });
    },
    { role: STRUCTURE },
  );
