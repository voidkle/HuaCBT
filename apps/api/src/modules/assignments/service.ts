import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../db";
import { assignmentFiles, assignments, assignmentSubmissions, classroomMembers, classroomSubjects, classrooms, type Role, subjects, users } from "../../db/schema";
import { cleanName } from "../../http/fileName";
import { uploadDir } from "../../storage";
import { getSettings } from "../config/service";

/** Who takes part at all (staff do not, as in Presence). */
export const ASSIGNEES = ["admin", "operator", "teacher", "student"] as const satisfies readonly Role[];
/** Who posts and grades (a teacher only for the subjects they teach). */
export const MANAGERS = ["admin", "operator", "teacher"] as const satisfies readonly Role[];
const ADMINS: readonly Role[] = ["admin", "operator"];

export const MAX_FILES = 5; // per assignment and per submission
export const MAX_TEXT = 10_000;
const MB = 1024 * 1024;

export interface Viewer {
  id: number;
  role: Role;
}

type Failure = { ok: false; code: 400 | 403 | 404 | 409 | 413 | 422; message: string };
type Result<T> = { ok: true; value: T } | Failure;
const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const noAssignment = fail(404, "Tugas tidak ditemukan");
const noSubmission = fail(404, "Jawaban tidak ditemukan");

// ---------- files on disk ----------

const filesDir = join(uploadDir, "assignments");
export const fileOnDisk = (id: number) => Bun.file(join(filesDir, String(id)));
const removeFromDisk = (ids: number[]) => Promise.all(ids.map((id) => rm(join(filesDir, String(id)), { force: true })));

/** Stores uploads for one owner. Nothing here is ever rendered inline (downloads are forced), so the declared type is not trusted or used. */
async function saveFiles(files: File[], owner: { assignmentId: number } | { submissionId: number }): Promise<Result<number[]>> {
  if (files.length === 0) return ok([]);
  const { maxAssignmentMb } = await getSettings();
  for (const f of files) {
    if (f.size === 0) return fail(422, `Berkas "${cleanName(f.name)}" kosong`);
    if (f.size > maxAssignmentMb * MB) return fail(413, `Ukuran berkas maksimal ${maxAssignmentMb} MB`);
  }
  const now = new Date();
  const rows = await db.insert(assignmentFiles).values(files.map((f) => ({ ...owner, name: cleanName(f.name), size: f.size, createdAt: now }))).returning({ id: assignmentFiles.id });
  const ids = rows.map((r) => r.id);
  try {
    await mkdir(filesDir, { recursive: true });
    await Promise.all(files.map((f, i) => Bun.write(fileOnDisk(ids[i]!), f)));
  } catch (e) {
    await db.delete(assignmentFiles).where(inArray(assignmentFiles.id, ids)); // don't leave rows without bytes
    await removeFromDisk(ids);
    throw e;
  }
  return ok(ids);
}

const filesOf = (where: { assignmentId: number } | { submissionId: number }) =>
  db
    .select({ id: assignmentFiles.id, name: assignmentFiles.name, size: assignmentFiles.size })
    .from(assignmentFiles)
    .where("assignmentId" in where ? eq(assignmentFiles.assignmentId, where.assignmentId) : eq(assignmentFiles.submissionId, where.submissionId))
    .orderBy(assignmentFiles.id);

// ---------- the assignment read model ----------

const teacher = alias(users, "teacher");
const effTeacherSql = sql`coalesce(${classroomSubjects.teacherId}, ${classrooms.homeroomTeacherId})`;

const base = () =>
  db
    .select({
      id: assignments.id,
      classroomId: assignments.classroomId,
      classroomName: classrooms.name,
      subjectId: assignments.subjectId,
      subjectName: subjects.name,
      title: assignments.title,
      instructions: assignments.instructions,
      dueAt: assignments.dueAt,
      allowLate: assignments.allowLate,
      maxPoints: assignments.maxPoints,
      createdAt: assignments.createdAt,
      teacherId: effTeacherSql.mapWith((v: string | number | null) => (v === null ? null : Number(v))),
      teacherName: teacher.name,
    })
    .from(assignments)
    .innerJoin(classrooms, eq(assignments.classroomId, classrooms.id))
    .innerJoin(subjects, eq(assignments.subjectId, subjects.id))
    .innerJoin(classroomSubjects, and(eq(classroomSubjects.classroomId, assignments.classroomId), eq(classroomSubjects.subjectId, assignments.subjectId)))
    .leftJoin(teacher, sql`${teacher.id} = ${effTeacherSql}`);

type Row = Awaited<ReturnType<typeof base>>[number];

/** Admin/operator, or the teacher who teaches that subject in that class. */
const manages = (v: Viewer, a: Pick<Row, "teacherId">) => ADMINS.includes(v.role) || (v.role === "teacher" && a.teacherId === v.id);

const isStudentOf = async (v: Viewer, classroomId: number) =>
  v.role === "student" && (await db.select({ n: count() }).from(classroomMembers).where(and(eq(classroomMembers.classroomId, classroomId), eq(classroomMembers.userId, v.id))))[0]!.n > 0;

/** An assignment the viewer may see: managers of it, or students of its class. Others get "not found". */
async function visible(v: Viewer, id: number): Promise<Result<{ a: Row; manage: boolean }>> {
  const [a] = await base().where(eq(assignments.id, id));
  if (!a) return noAssignment;
  const manage = manages(v, a);
  return manage || (await isStudentOf(v, a.classroomId)) ? ok({ a, manage }) : noAssignment;
}

const studentsIn = (classroomId: number) =>
  db
    .select({ id: users.id, name: users.name, username: users.username })
    .from(classroomMembers)
    .innerJoin(users, eq(classroomMembers.userId, users.id))
    .where(and(eq(classroomMembers.classroomId, classroomId), eq(users.role, "student")))
    .orderBy(users.name);

type SubStatus = "missing" | "submitted" | "graded";
const statusOf = (s: { gradedAt: Date | null } | null | undefined): SubStatus => (!s ? "missing" : s.gradedAt ? "graded" : "submitted");

const subShape = async (s: typeof assignmentSubmissions.$inferSelect) => ({
  id: s.id,
  text: s.text,
  submittedAt: s.submittedAt,
  late: s.late,
  status: statusOf(s),
  score: s.score,
  feedback: s.feedback,
  gradedAt: s.gradedAt,
  files: await filesOf({ submissionId: s.id }),
});

// ---------- listing ----------

/** Classes + subjects the viewer may post to (a teacher: the ones they teach; admin/operator: all). */
export async function targets(v: Viewer) {
  const rows = await db
    .select({ classroomId: classrooms.id, classroomName: classrooms.name, subjectId: subjects.id, subjectName: subjects.name })
    .from(classroomSubjects)
    .innerJoin(classrooms, eq(classroomSubjects.classroomId, classrooms.id))
    .innerJoin(subjects, eq(classroomSubjects.subjectId, subjects.id))
    .where(ADMINS.includes(v.role) ? undefined : sql`${effTeacherSql} = ${v.id}`)
    .orderBy(classrooms.name, subjects.name);
  const byClass = new Map<number, { classroomId: number; classroomName: string; subjects: { id: number; name: string }[] }>();
  for (const r of rows) {
    const c = byClass.get(r.classroomId) ?? { classroomId: r.classroomId, classroomName: r.classroomName, subjects: [] };
    c.subjects.push({ id: r.subjectId, name: r.subjectName });
    byClass.set(r.classroomId, c);
  }
  return [...byClass.values()];
}

export async function listAssignments(v: Viewer, classroomId?: number) {
  const mine = db.select({ id: classroomMembers.classroomId }).from(classroomMembers).where(eq(classroomMembers.userId, v.id));
  const scope = ADMINS.includes(v.role) ? undefined : v.role === "teacher" ? sql`${effTeacherSql} = ${v.id}` : inArray(assignments.classroomId, mine);
  const rows = await base()
    .where(and(scope, classroomId ? eq(assignments.classroomId, classroomId) : undefined))
    .orderBy(desc(assignments.dueAt))
    .limit(300);
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];
  if (v.role === "student") {
    const subs = new Map((await db.select().from(assignmentSubmissions).where(and(inArray(assignmentSubmissions.assignmentId, ids), eq(assignmentSubmissions.studentId, v.id)))).map((s) => [s.assignmentId, s]));
    return rows.map((r) => ({ ...r, canManage: false, mine: subs.has(r.id) ? { status: statusOf(subs.get(r.id)), late: subs.get(r.id)!.late, score: subs.get(r.id)!.score } : { status: "missing" as SubStatus, late: false, score: null }, counts: null }));
  }
  const classIds = [...new Set(rows.map((r) => r.classroomId))];
  const [totals, subCounts] = await Promise.all([
    db
      .select({ id: classroomMembers.classroomId, n: count() })
      .from(classroomMembers)
      .innerJoin(users, eq(classroomMembers.userId, users.id))
      .where(and(inArray(classroomMembers.classroomId, classIds), eq(users.role, "student")))
      .groupBy(classroomMembers.classroomId),
    db
      .select({ id: assignmentSubmissions.assignmentId, submitted: count(), graded: sql<number>`count(${assignmentSubmissions.gradedAt})`.mapWith(Number) })
      .from(assignmentSubmissions)
      .where(inArray(assignmentSubmissions.assignmentId, ids))
      .groupBy(assignmentSubmissions.assignmentId),
  ]);
  const total = new Map(totals.map((t) => [t.id, t.n]));
  const sub = new Map(subCounts.map((s) => [s.id, s]));
  return rows.map((r) => ({ ...r, canManage: manages(v, r), mine: null, counts: { total: total.get(r.classroomId) ?? 0, submitted: sub.get(r.id)?.submitted ?? 0, graded: sub.get(r.id)?.graded ?? 0 } }));
}

export async function getAssignment(v: Viewer, id: number) {
  const r = await visible(v, id);
  if (!r.ok) return r;
  const { a, manage } = r.value;
  const [files, own] = await Promise.all([
    filesOf({ assignmentId: id }),
    v.role === "student" ? db.select().from(assignmentSubmissions).where(and(eq(assignmentSubmissions.assignmentId, id), eq(assignmentSubmissions.studentId, v.id))) : Promise.resolve([]),
  ]);
  return ok({ ...a, canManage: manage, files, mine: own[0] ? await subShape(own[0]) : null });
}

// ---------- posting ----------

interface Input {
  title: string;
  instructions: string;
  dueAt: Date;
  allowLate: boolean;
  maxPoints: number;
}

export async function createAssignment(v: Viewer, input: Input & { classroomId: number; subjectId: number }): Promise<Result<{ id: number }>> {
  const [slot] = await db
    .select({ teacherId: effTeacherSql.mapWith((x: string | number | null) => (x === null ? null : Number(x))) })
    .from(classroomSubjects)
    .innerJoin(classrooms, eq(classroomSubjects.classroomId, classrooms.id))
    .where(and(eq(classroomSubjects.classroomId, input.classroomId), eq(classroomSubjects.subjectId, input.subjectId)));
  if (!slot || !manages(v, slot)) return fail(404, "Kelas atau mata pelajaran tidak ditemukan");
  const [row] = await db
    .insert(assignments)
    .values({ classroomId: input.classroomId, subjectId: input.subjectId, title: input.title.trim(), instructions: input.instructions.trim(), dueAt: input.dueAt, allowLate: input.allowLate, maxPoints: input.maxPoints, createdBy: v.id, createdAt: new Date() })
    .returning({ id: assignments.id });
  return ok(row!);
}

export async function updateAssignment(v: Viewer, id: number, input: Input): Promise<Result<{ id: number }>> {
  const r = await visible(v, id);
  if (!r.ok) return r;
  if (!r.value.manage) return fail(403, "Tidak diizinkan");
  const [top] = await db.select({ top: sql<number | null>`max(${assignmentSubmissions.score})`.mapWith((x: string | number | null) => (x === null ? null : Number(x))) }).from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, id));
  if (top?.top != null && input.maxPoints < top.top) return fail(409, `Sudah ada nilai ${top.top}; nilai maksimal tidak boleh lebih kecil`);
  await db.update(assignments).set({ title: input.title.trim(), instructions: input.instructions.trim(), dueAt: input.dueAt, allowLate: input.allowLate, maxPoints: input.maxPoints }).where(eq(assignments.id, id));
  return ok({ id });
}

/** ponytail: rows cascade, but files of an assignment removed *indirectly* (its class or subject deleted) stay on disk as orphans. A cleanup sweep can drop ids with no row. */
export async function deleteAssignment(v: Viewer, id: number): Promise<Result<true>> {
  const r = await visible(v, id);
  if (!r.ok) return r;
  if (!r.value.manage) return fail(403, "Tidak diizinkan");
  const subs = db.select({ id: assignmentSubmissions.id }).from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, id));
  const doomed = await db.select({ id: assignmentFiles.id }).from(assignmentFiles).where(sql`${assignmentFiles.assignmentId} = ${id} or ${assignmentFiles.submissionId} in (${subs})`);
  await db.delete(assignments).where(eq(assignments.id, id)); // submissions and file rows cascade
  await removeFromDisk(doomed.map((d) => d.id));
  return ok(true);
}

export async function addAssignmentFiles(v: Viewer, id: number, files: File[]): Promise<Result<true>> {
  const r = await visible(v, id);
  if (!r.ok) return r;
  if (!r.value.manage) return fail(403, "Tidak diizinkan");
  if (files.length === 0) return fail(422, "Pilih berkas");
  if ((await filesOf({ assignmentId: id })).length + files.length > MAX_FILES) return fail(422, `Maksimal ${MAX_FILES} berkas per tugas`);
  const saved = await saveFiles(files, { assignmentId: id });
  return saved.ok ? ok(true) : saved;
}

export async function removeAssignmentFile(v: Viewer, id: number, fileId: number): Promise<Result<true>> {
  const r = await visible(v, id);
  if (!r.ok) return r;
  if (!r.value.manage) return fail(403, "Tidak diizinkan");
  const gone = await db.delete(assignmentFiles).where(and(eq(assignmentFiles.id, fileId), eq(assignmentFiles.assignmentId, id))).returning({ id: assignmentFiles.id });
  if (gone.length === 0) return fail(404, "Berkas tidak ditemukan");
  await removeFromDisk([fileId]);
  return ok(true);
}

/** A file the viewer may download: the class's members and managers for the worksheet, the owner and managers for an answer. */
export async function downloadable(v: Viewer, fileId: number): Promise<Result<{ file: Bun.BunFile; name: string }>> {
  const [f] = await db.select().from(assignmentFiles).where(eq(assignmentFiles.id, fileId));
  const gone = fail(404, "Berkas tidak ditemukan");
  if (!f) return gone;
  let assignmentId = f.assignmentId;
  let ownerId: number | null = null;
  if (f.submissionId) {
    const [s] = await db.select({ assignmentId: assignmentSubmissions.assignmentId, studentId: assignmentSubmissions.studentId }).from(assignmentSubmissions).where(eq(assignmentSubmissions.id, f.submissionId));
    if (!s) return gone;
    assignmentId = s.assignmentId;
    ownerId = s.studentId;
  }
  const r = await visible(v, assignmentId!);
  if (!r.ok || (ownerId !== null && !r.value.manage && ownerId !== v.id)) return gone;
  return ok({ file: fileOnDisk(fileId), name: f.name });
}

// ---------- answering ----------

/** `keep` = ids of already attached files to keep; every other earlier file is dropped. */
export async function submit(v: Viewer, id: number, input: { text: string; keep: number[]; files: File[] }): Promise<Result<{ status: SubStatus; late: boolean }>> {
  const r = await visible(v, id);
  if (!r.ok) return r;
  if (r.value.manage || v.role !== "student") return fail(403, "Hanya siswa di kelas ini yang dapat mengumpulkan");
  const { a } = r.value;
  const now = new Date();
  const late = now > a.dueAt;
  if (late && !a.allowLate) return fail(409, "Batas waktu pengumpulan sudah lewat");
  const [existing] = await db.select().from(assignmentSubmissions).where(and(eq(assignmentSubmissions.assignmentId, id), eq(assignmentSubmissions.studentId, v.id)));
  if (existing?.gradedAt) return fail(409, "Tugas sudah dinilai dan tidak bisa diubah lagi");
  const text = input.text.trim();
  if (text.length > MAX_TEXT) return fail(422, `Jawaban maksimal ${MAX_TEXT} karakter`);
  const have = existing ? await filesOf({ submissionId: existing.id }) : [];
  const keepIds = new Set(input.keep.filter((k) => have.some((h) => h.id === k)));
  if (keepIds.size + input.files.length > MAX_FILES) return fail(422, `Maksimal ${MAX_FILES} berkas`);
  if (!text && keepIds.size + input.files.length === 0) return fail(422, "Isi jawaban atau lampirkan berkas");

  const [{ id: submissionId }] = await db
    .insert(assignmentSubmissions)
    .values({ assignmentId: id, studentId: v.id, text, submittedAt: now, late })
    .onConflictDoUpdate({ target: [assignmentSubmissions.assignmentId, assignmentSubmissions.studentId], set: { text, submittedAt: now, late } })
    .returning({ id: assignmentSubmissions.id }) as [{ id: number }];
  const saved = await saveFiles(input.files, { submissionId });
  if (!saved.ok) return saved; // earlier files stay; the student sees the error and tries again
  const dropped = have.filter((h) => !keepIds.has(h.id)).map((h) => h.id);
  if (dropped.length) {
    await db.delete(assignmentFiles).where(inArray(assignmentFiles.id, dropped));
    await removeFromDisk(dropped);
  }
  return ok({ status: "submitted", late });
}

// ---------- grading (managers) ----------

/** Every student of the class with their status (students who have not answered included). */
export async function roster(v: Viewer, id: number) {
  const r = await visible(v, id);
  if (!r.ok) return r;
  if (!r.value.manage) return fail(403, "Tidak diizinkan");
  const [students, subs] = await Promise.all([studentsIn(r.value.a.classroomId), db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, id))]);
  const byStudent = new Map(subs.map((s) => [s.studentId, s]));
  return ok(
    students.map((s) => {
      const sub = byStudent.get(s.id);
      return { ...s, submissionId: sub?.id ?? null, status: statusOf(sub), submittedAt: sub?.submittedAt ?? null, late: sub?.late ?? false, score: sub?.score ?? null };
    }),
  );
}

async function managedSubmission(v: Viewer, submissionId: number): Promise<Result<{ s: typeof assignmentSubmissions.$inferSelect; a: Row }>> {
  const [s] = await db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.id, submissionId));
  if (!s) return noSubmission;
  const r = await visible(v, s.assignmentId);
  if (!r.ok || !r.value.manage) return noSubmission;
  return ok({ s, a: r.value.a });
}

export async function getSubmission(v: Viewer, submissionId: number) {
  const r = await managedSubmission(v, submissionId);
  if (!r.ok) return r;
  const [student] = await db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(eq(users.id, r.value.s.studentId));
  return ok({ ...(await subShape(r.value.s)), student, assignment: { id: r.value.a.id, title: r.value.a.title, maxPoints: r.value.a.maxPoints } });
}

export async function grade(v: Viewer, submissionId: number, input: { score: number; feedback: string }): Promise<Result<true>> {
  const r = await managedSubmission(v, submissionId);
  if (!r.ok) return r;
  if (input.score < 0 || input.score > r.value.a.maxPoints) return fail(422, `Nilai harus 0 sampai ${r.value.a.maxPoints}`);
  await db.update(assignmentSubmissions).set({ score: input.score, feedback: input.feedback.trim() || null, gradedAt: new Date(), gradedBy: v.id }).where(eq(assignmentSubmissions.id, submissionId));
  return ok(true);
}

/** Clears the grade so the student can edit and resubmit. */
export async function reopen(v: Viewer, submissionId: number): Promise<Result<true>> {
  const r = await managedSubmission(v, submissionId);
  if (!r.ok) return r;
  await db.update(assignmentSubmissions).set({ score: null, feedback: null, gradedAt: null, gradedBy: null }).where(eq(assignmentSubmissions.id, submissionId));
  return ok(true);
}
