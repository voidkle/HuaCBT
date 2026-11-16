import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db";
import { type ClassSystem, classroomMembers, classroomSubjects, classrooms, lessons, type Role, rooms, subjects, users } from "../../db/schema";
import { getSettings } from "../config/service";
import { clashMessage, firstClash, type Slot } from "./rules";

/** Who maintains the school structure (classes, subjects, rooms, teacher assignments, timetable). Everyone else only reads what concerns them. */
export const STRUCTURE = ["admin", "operator", "staff"] as const satisfies readonly Role[];

export interface Viewer {
  id: number;
  role: Role;
}

type Failure = { ok: false; code: 400 | 404 | 409; message: string };
type Result<T> = { ok: true; value: T } | Failure;
const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const noClass = fail(404, "Kelas tidak ditemukan");
const isManager = (v: Viewer) => (STRUCTURE as readonly Role[]).includes(v.role);
const clean = (s: string) => s.trim();

const teacher = alias(users, "teacher");
/** The teacher who actually teaches a lesson: the assignment's own teacher, else the class's homeroom teacher. */
const effTeacher = sql`coalesce(${classroomSubjects.teacherId}, ${classrooms.homeroomTeacherId})`.mapWith((v: string | number | null) => (v === null ? null : Number(v)));

// ---------- catalog: teachers, subjects, rooms ----------

export const listTeachers = () => db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(eq(users.role, "teacher")).orderBy(users.name);
const isTeacher = async (id: number) => (await db.select({ n: count() }).from(users).where(and(eq(users.id, id), eq(users.role, "teacher"))))[0]!.n > 0;
const noTeacher = fail(400, "Guru tidak ditemukan");

/** Names are unique ignoring case (a unique index backs this up; the pre-check gives a friendly message). */
const nameTaken = async (table: typeof subjects | typeof rooms, name: string, exceptId: number | null) =>
  (await db.select({ id: table.id }).from(table).where(sql`lower(${table.name}) = lower(${clean(name)})`)).some((r) => r.id !== exceptId);

export const listSubjects = () => db.select().from(subjects).orderBy(subjects.name);

export async function saveSubject(id: number | null, name: string): Promise<Result<{ id: number }>> {
  if (await nameTaken(subjects, name, id)) return fail(409, "Nama mata pelajaran sudah ada");
  if (id === null) return ok((await db.insert(subjects).values({ name: clean(name) }).returning({ id: subjects.id }))[0]!);
  const r = await db.update(subjects).set({ name: clean(name) }).where(eq(subjects.id, id)).returning({ id: subjects.id });
  return r[0] ? ok(r[0]) : fail(404, "Mata pelajaran tidak ditemukan");
}

export async function deleteSubject(id: number): Promise<Result<true>> {
  const r = await db.delete(subjects).where(eq(subjects.id, id)).returning({ id: subjects.id }); // assignments and their lessons cascade
  return r[0] ? ok(true) : fail(404, "Mata pelajaran tidak ditemukan");
}

export const listRooms = () =>
  db.select({ id: rooms.id, name: rooms.name, ownerId: rooms.ownerId, ownerName: users.name }).from(rooms).leftJoin(users, eq(rooms.ownerId, users.id)).orderBy(rooms.name);

export async function saveRoom(id: number | null, input: { name: string; ownerId?: number | null }): Promise<Result<{ id: number }>> {
  if (input.ownerId && !(await isTeacher(input.ownerId))) return noTeacher;
  if (await nameTaken(rooms, input.name, id)) return fail(409, "Nama ruang sudah ada");
  const values = { name: clean(input.name), ownerId: input.ownerId ?? null };
  if (id === null) return ok((await db.insert(rooms).values(values).returning({ id: rooms.id }))[0]!);
  const r = await db.update(rooms).set(values).where(eq(rooms.id, id)).returning({ id: rooms.id });
  return r[0] ? ok(r[0]) : fail(404, "Ruang tidak ditemukan");
}

export async function deleteRoom(id: number): Promise<Result<true>> {
  const r = await db.delete(rooms).where(eq(rooms.id, id)).returning({ id: rooms.id }); // lessons there become "stay in the class room"
  return r[0] ? ok(true) : fail(404, "Ruang tidak ditemukan");
}

// ---------- lessons (the shared read model) ----------

const lessonRows = () =>
  db
    .select({
      id: lessons.id,
      classroomId: lessons.classroomId,
      classroomName: classrooms.name,
      subjectId: lessons.subjectId,
      subjectName: subjects.name,
      weekday: lessons.weekday,
      startMin: lessons.startMin,
      endMin: lessons.endMin,
      roomId: lessons.roomId,
      roomName: rooms.name,
      teacherId: effTeacher,
      teacherName: teacher.name,
    })
    .from(lessons)
    .innerJoin(classrooms, eq(lessons.classroomId, classrooms.id))
    .innerJoin(subjects, eq(lessons.subjectId, subjects.id))
    .innerJoin(classroomSubjects, and(eq(classroomSubjects.classroomId, lessons.classroomId), eq(classroomSubjects.subjectId, lessons.subjectId)))
    .leftJoin(rooms, eq(lessons.roomId, rooms.id))
    .leftJoin(teacher, sql`${teacher.id} = coalesce(${classroomSubjects.teacherId}, ${classrooms.homeroomTeacherId})`);

type LessonRow = Awaited<ReturnType<typeof lessonRows>>[number];
const slotOf = (l: Pick<LessonRow, "id" | "classroomId" | "teacherId" | "roomId" | "weekday" | "startMin" | "endMin">): Slot => l;
/** Moving class is a school setting: when it is off, rooms are kept in the DB but ignored everywhere (not shown, never clash). */
const movingOn = async () => (await getSettings()).movingClass;
const hideRooms = (rows: LessonRow[], moving: boolean) => (moving ? rows : rows.map((r) => ({ ...r, roomId: null, roomName: null })));
const slotsOnDay = async (weekday: number) => hideRooms(await lessonRows().where(eq(lessons.weekday, weekday)), await movingOn()).map(slotOf);
// ponytail: clash checks read, then write, without a lock; two admins editing the same minute could double-book. Add an exclusion constraint if that ever happens.

// ---------- classes ----------

interface ClassInput {
  name: string;
  grade?: string | null;
  homeroomTeacherId?: number | null;
}

/** Classes the viewer may see: managers all; a teacher those they own, advise, teach in or belong to; a student their own. */
const visible = (v: Viewer) => {
  if (isManager(v)) return undefined;
  const mine = db.select({ id: classroomMembers.classroomId }).from(classroomMembers).where(eq(classroomMembers.userId, v.id));
  if (v.role !== "teacher") return inArray(classrooms.id, mine);
  const taught = db.select({ id: classroomSubjects.classroomId }).from(classroomSubjects).where(eq(classroomSubjects.teacherId, v.id));
  return or(eq(classrooms.ownerId, v.id), eq(classrooms.homeroomTeacherId, v.id), inArray(classrooms.id, mine), inArray(classrooms.id, taught));
};

const classRows = () =>
  db
    .select({ id: classrooms.id, name: classrooms.name, grade: classrooms.grade, homeroomTeacherId: classrooms.homeroomTeacherId, homeroomTeacherName: teacher.name })
    .from(classrooms)
    .leftJoin(teacher, eq(classrooms.homeroomTeacherId, teacher.id));

/** `system` is the school-wide mode (Config), not a per-class column: the old `classrooms.system` is unused. */
export async function listClasses(v: Viewer) {
  const [rows, { classSystem }] = await Promise.all([classRows().where(visible(v)).orderBy(classrooms.name), getSettings()]);
  const ids = rows.map((r) => r.id);
  const counts = new Map(
    ids.length ? (await db.select({ id: classroomMembers.classroomId, n: count() }).from(classroomMembers).where(inArray(classroomMembers.classroomId, ids)).groupBy(classroomMembers.classroomId)).map((r) => [r.id, r.n]) : [],
  );
  return rows.map((r) => ({ ...r, system: classSystem, memberCount: counts.get(r.id) ?? 0 }));
}

export async function getClass(v: Viewer, id: number): Promise<Result<Awaited<ReturnType<typeof classRows>>[number] & { system: ClassSystem; memberCount: number; subjects: Subject[]; lessons: Lesson[] }>> {
  const [row] = await classRows().where(and(eq(classrooms.id, id), visible(v)));
  if (!row) return noClass;
  const [assigned, rows, [members], settings] = await Promise.all([
    db
      .select({ subjectId: subjects.id, name: subjects.name, teacherId: classroomSubjects.teacherId, teacherName: teacher.name })
      .from(classroomSubjects)
      .innerJoin(subjects, eq(classroomSubjects.subjectId, subjects.id))
      .leftJoin(teacher, eq(classroomSubjects.teacherId, teacher.id))
      .where(eq(classroomSubjects.classroomId, id))
      .orderBy(subjects.name),
    lessonRows().where(eq(lessons.classroomId, id)).orderBy(lessons.weekday, lessons.startMin),
    db.select({ n: count() }).from(classroomMembers).where(eq(classroomMembers.classroomId, id)),
    getSettings(),
  ]);
  const subs = assigned.map((a) => ({
    ...a,
    inherited: a.teacherId === null && row.homeroomTeacherId !== null, // taught by the homeroom teacher
    effectiveTeacherId: a.teacherId ?? row.homeroomTeacherId,
    effectiveTeacherName: a.teacherId === null ? row.homeroomTeacherName : a.teacherName,
  }));
  return ok({ ...row, system: settings.classSystem, memberCount: members!.n, subjects: subs, lessons: hideRooms(rows, settings.movingClass).map(lessonShape) });
}

type Subject = { subjectId: number; name: string; teacherId: number | null; teacherName: string | null; inherited: boolean; effectiveTeacherId: number | null; effectiveTeacherName: string | null };
const lessonShape = ({ classroomName: _c, ...l }: LessonRow) => l;
type Lesson = ReturnType<typeof lessonShape>;

/** Lessons of one class re-resolved against a new teacher (for the clash check). */
const withTeacher = (rows: LessonRow[], teacherId: number | null): Slot[] => rows.map((r) => slotOf({ ...r, teacherId }));

export async function createClass(v: Viewer, input: ClassInput): Promise<Result<{ id: number }>> {
  if (input.homeroomTeacherId && !(await isTeacher(input.homeroomTeacherId))) return noTeacher;
  const [row] = await db
    .insert(classrooms)
    .values({ name: clean(input.name), grade: input.grade ? clean(input.grade) : null, homeroomTeacherId: input.homeroomTeacherId ?? null, ownerId: v.id })
    .returning({ id: classrooms.id });
  return ok(row!);
}

export async function updateClass(id: number, input: ClassInput): Promise<Result<{ id: number }>> {
  const [cur] = await db.select().from(classrooms).where(eq(classrooms.id, id));
  if (!cur) return noClass;
  const homeroom = input.homeroomTeacherId ?? null;
  if (homeroom && !(await isTeacher(homeroom))) return noTeacher;
  if (homeroom !== cur.homeroomTeacherId) {
    // lessons taught by the homeroom teacher (no own teacher) move with the homeroom teacher: re-check them
    const inherited = (await lessonRows().where(and(eq(lessons.classroomId, id), sql`${classroomSubjects.teacherId} is null`)));
    const clashing = homeroom === null ? null : await clashFor(withTeacher(inherited, homeroom));
    if (clashing) return fail(409, clashing);
  }
  await db.update(classrooms).set({ name: clean(input.name), grade: input.grade ? clean(input.grade) : null, homeroomTeacherId: homeroom }).where(eq(classrooms.id, id));
  return ok({ id });
}

async function clashFor(candidates: Slot[]): Promise<string | null> {
  const days = [...new Set(candidates.map((c) => c.weekday))];
  if (days.length === 0) return null;
  const others = hideRooms(await lessonRows().where(inArray(lessons.weekday, days)), await movingOn()).map(slotOf);
  const kind = firstClash(candidates, others);
  return kind ? clashMessage[kind] : null;
}

// ---------- subject assignments ----------

/** Give a class a subject and say who teaches it (`null` = the homeroom teacher, homeroom classes only). */
export async function assignSubject(classroomId: number, subjectId: number, teacherId: number | null): Promise<Result<true>> {
  const [c] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId));
  if (!c) return noClass;
  if ((await db.select({ n: count() }).from(subjects).where(eq(subjects.id, subjectId)))[0]!.n === 0) return fail(404, "Mata pelajaran tidak ditemukan");
  if (teacherId === null && (await getSettings()).classSystem === "subject_teachers") return fail(400, "Pilih guru untuk mata pelajaran ini");
  if (teacherId !== null && !(await isTeacher(teacherId))) return noTeacher;
  const existing = await lessonRows().where(and(eq(lessons.classroomId, classroomId), eq(lessons.subjectId, subjectId)));
  const clashing = await clashFor(withTeacher(existing, teacherId ?? c.homeroomTeacherId));
  if (clashing) return fail(409, clashing);
  await db.insert(classroomSubjects).values({ classroomId, subjectId, teacherId }).onConflictDoUpdate({ target: [classroomSubjects.classroomId, classroomSubjects.subjectId], set: { teacherId } });
  return ok(true);
}

export async function unassignSubject(classroomId: number, subjectId: number): Promise<Result<true>> {
  const r = await db.delete(classroomSubjects).where(and(eq(classroomSubjects.classroomId, classroomId), eq(classroomSubjects.subjectId, subjectId))).returning({ id: classroomSubjects.subjectId }); // its lessons cascade
  return r[0] ? ok(true) : fail(404, "Mata pelajaran tidak ada di kelas ini");
}

// ---------- timetable ----------

interface LessonInput {
  weekday: number;
  startMin: number;
  endMin: number;
  roomId?: number | null;
}

async function checkLesson(id: number | null, classroomId: number, subjectId: number, input: LessonInput): Promise<Result<{ roomId: number | null; moving: boolean }>> {
  if (input.startMin >= input.endMin) return fail(400, "Jam selesai harus setelah jam mulai");
  const [a] = await db
    .select({ teacherId: effTeacher })
    .from(classroomSubjects)
    .innerJoin(classrooms, eq(classrooms.id, classroomSubjects.classroomId))
    .where(and(eq(classroomSubjects.classroomId, classroomId), eq(classroomSubjects.subjectId, subjectId)));
  if (!a) return fail(400, "Tambahkan mata pelajaran ini ke kelas dahulu");
  const moving = await movingOn();
  const roomId = moving ? (input.roomId ?? null) : null; // rooms only exist while moving class is on
  if (roomId !== null && (await db.select({ n: count() }).from(rooms).where(eq(rooms.id, roomId)))[0]!.n === 0) return fail(400, "Ruang tidak ditemukan");
  const kind = firstClash([{ id: id ?? -1, classroomId, teacherId: a.teacherId, roomId, weekday: input.weekday, startMin: input.startMin, endMin: input.endMin }], await slotsOnDay(input.weekday));
  return kind ? fail(409, clashMessage[kind]) : ok({ roomId, moving });
}

export async function addLesson(classroomId: number, subjectId: number, input: LessonInput): Promise<Result<{ id: number }>> {
  const c = await checkLesson(null, classroomId, subjectId, input);
  if (!c.ok) return c;
  const [row] = await db.insert(lessons).values({ classroomId, subjectId, weekday: input.weekday, startMin: input.startMin, endMin: input.endMin, roomId: c.value.roomId }).returning({ id: lessons.id });
  return ok(row!);
}

export async function updateLesson(classroomId: number, id: number, input: LessonInput): Promise<Result<{ id: number }>> {
  const [cur] = await db.select().from(lessons).where(and(eq(lessons.id, id), eq(lessons.classroomId, classroomId)));
  if (!cur) return fail(404, "Pelajaran tidak ditemukan");
  const c = await checkLesson(id, classroomId, cur.subjectId, input);
  if (!c.ok) return c;
  await db.update(lessons).set({ weekday: input.weekday, startMin: input.startMin, endMin: input.endMin, ...(c.value.moving ? { roomId: c.value.roomId } : {}) }).where(eq(lessons.id, id)); // with moving class off, a stored room is left untouched
  return ok({ id });
}

export async function removeLesson(classroomId: number, id: number): Promise<Result<true>> {
  const r = await db.delete(lessons).where(and(eq(lessons.id, id), eq(lessons.classroomId, classroomId))).returning({ id: lessons.id });
  return r[0] ? ok(true) : fail(404, "Pelajaran tidak ditemukan");
}

/** "Where do I go": a teacher's own lessons, or the lessons of the classes a student belongs to. Managers use the class pages instead. */
export async function mySchedule(v: Viewer) {
  const mine = db.select({ id: classroomMembers.classroomId }).from(classroomMembers).where(eq(classroomMembers.userId, v.id));
  const where = v.role === "teacher" ? sql`coalesce(${classroomSubjects.teacherId}, ${classrooms.homeroomTeacherId}) = ${v.id}` : v.role === "student" ? inArray(lessons.classroomId, mine) : sql`false`;
  return hideRooms(await lessonRows().where(where).orderBy(lessons.weekday, lessons.startMin), await movingOn());
}

/** Why the school cannot switch to `target` right now (null = fine). Guru mata pelajaran needs an own teacher on every subject; guru kelas keeps the teachers already chosen. */
export async function classSwitchProblem(target: ClassSystem): Promise<string | null> {
  if (target !== "subject_teachers") return null;
  const [r] = await db.select({ n: count() }).from(classroomSubjects).where(sql`${classroomSubjects.teacherId} is null`);
  return r!.n > 0 ? `${r!.n} mata pelajaran masih diajar guru kelas. Pilih guru untuk setiap mata pelajaran di Kelas & Jadwal dahulu.` : null;
}
