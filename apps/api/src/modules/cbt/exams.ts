import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { examAttempts, examOptions, examQuestions, exams, type QuestionType, users } from "../../db/schema";
import { fail, isAdmin, ok, outerExamId, type Result, type Viewer } from "./result";

export interface ExamSettings {
  title: string;
  description: string;
  durationMinutes: number | null;
  opensAt: string | null;
  closesAt: string | null;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showTimer: boolean;
  accessToken: string | null;
  showScore: boolean;
  showReview: boolean;
}

export interface QuestionInput {
  type: QuestionType;
  text: string;
  explanation: string;
  points: number;
  options: { text: string; correct: boolean }[];
}

type Exam = typeof exams.$inferSelect;

/** Loads an exam the viewer may manage (own exams, or any for admin/operator). */
export async function loadManagedExam(v: Viewer, examId: number): Promise<Result<Exam>> {
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId));
  if (!exam) return fail(404, "Ujian tidak ditemukan");
  if (!isAdmin(v) && exam.createdBy !== v.id) return fail(403, "Kamu tidak mengelola ujian ini");
  return ok(exam);
}

const parseDate = (raw: string | null | undefined): Date | null | "invalid" => {
  if (raw == null || raw === "") return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? "invalid" : new Date(t);
};

/** Validates and converts the editable settings (shared by create and update). */
function toColumns(input: Partial<ExamSettings>): Result<Partial<typeof exams.$inferInsert>> {
  const cols: Partial<typeof exams.$inferInsert> = {};
  if (input.title !== undefined) cols.title = input.title.trim();
  if (input.description !== undefined) cols.description = input.description.trim();
  if (input.durationMinutes !== undefined) cols.durationMinutes = input.durationMinutes;
  if (input.maxAttempts !== undefined) cols.maxAttempts = input.maxAttempts;
  for (const k of ["shuffleQuestions", "shuffleOptions", "showTimer", "showScore", "showReview"] as const) if (input[k] !== undefined) cols[k] = input[k];
  if (input.accessToken !== undefined) cols.accessToken = input.accessToken?.trim() ? input.accessToken.trim() : null;
  for (const k of ["opensAt", "closesAt"] as const) {
    if (input[k] === undefined) continue;
    const d = parseDate(input[k]);
    if (d === "invalid") return fail(422, "Tanggal tidak valid");
    cols[k] = d;
  }
  return ok(cols);
}

const windowError = (opens: Date | null | undefined, closes: Date | null | undefined) =>
  opens && closes && closes <= opens ? fail(422, "Waktu tutup harus setelah waktu buka") : null;

export async function createExam(v: Viewer, input: ExamSettings): Promise<Result<{ id: number }>> {
  const cols = toColumns(input);
  if (!cols.ok) return cols;
  const bad = windowError(cols.value.opensAt, cols.value.closesAt);
  if (bad) return bad;
  const [row] = await db.insert(exams).values({ ...cols.value, title: cols.value.title!, createdBy: v.id }).returning({ id: exams.id });
  return ok({ id: row!.id });
}

export async function updateExam(v: Viewer, id: number, patch: Partial<ExamSettings>): Promise<Result<true>> {
  const loaded = await loadManagedExam(v, id);
  if (!loaded.ok) return loaded;
  const cols = toColumns(patch);
  if (!cols.ok) return cols;
  const opens = cols.value.opensAt !== undefined ? cols.value.opensAt : loaded.value.opensAt;
  const closes = cols.value.closesAt !== undefined ? cols.value.closesAt : loaded.value.closesAt;
  const bad = windowError(opens, closes);
  if (bad) return bad;
  if (Object.keys(cols.value).length) await db.update(exams).set(cols.value).where(eq(exams.id, id));
  return ok(true);
}

export async function deleteExam(v: Viewer, id: number): Promise<Result<true>> {
  const loaded = await loadManagedExam(v, id);
  if (!loaded.ok) return loaded;
  await db.delete(exams).where(eq(exams.id, id)); // questions, attempts and answers cascade
  return ok(true);
}

export async function setPublished(v: Viewer, id: number, published: boolean): Promise<Result<true>> {
  const loaded = await loadManagedExam(v, id);
  if (!loaded.ok) return loaded;
  if (published) {
    const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(examQuestions).where(eq(examQuestions.examId, id))) as [{ n: number }];
    if (n === 0) return fail(422, "Tambahkan minimal satu pertanyaan sebelum menerbitkan");
  }
  await db.update(exams).set({ status: published ? "published" : "draft" }).where(eq(exams.id, id));
  return ok(true);
}

// ---------------------------------------------------------------- listing

export async function listManaged(v: Viewer) {
  return db
    .select({
      id: exams.id,
      title: exams.title,
      status: exams.status,
      durationMinutes: exams.durationMinutes,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      maxAttempts: exams.maxAttempts,
      createdAt: exams.createdAt,
      ownerId: exams.createdBy,
      ownerName: users.name,
      questionCount: sql<number>`(select count(*)::int from exam_questions q where q.exam_id = ${outerExamId})`,
      totalPoints: sql<number>`(select coalesce(sum(q.points), 0)::int from exam_questions q where q.exam_id = ${outerExamId})`,
      attempts: sql<number>`(select count(*)::int from exam_attempts a where a.exam_id = ${outerExamId} and a.status = 'submitted')`,
      needsGrading: sql<number>`(select count(*)::int from exam_attempts a where a.exam_id = ${outerExamId} and a.status = 'submitted' and a.graded_at is null)`,
    })
    .from(exams)
    .leftJoin(users, eq(exams.createdBy, users.id))
    .where(isAdmin(v) ? undefined : eq(exams.createdBy, v.id))
    .orderBy(desc(exams.createdAt));
}

// ---------------------------------------------------------------- editor

export async function getEditorExam(v: Viewer, id: number) {
  const loaded = await loadManagedExam(v, id);
  if (!loaded.ok) return loaded;
  const exam = loaded.value;
  const questions = await db.select().from(examQuestions).where(eq(examQuestions.examId, id)).orderBy(examQuestions.position);
  const options = questions.length ? await db.select().from(examOptions).where(inArray(examOptions.questionId, questions.map((q) => q.id))).orderBy(examOptions.position) : [];
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(examAttempts).where(eq(examAttempts.examId, id))) as [{ n: number }];
  return ok({
    id: exam.id,
    title: exam.title,
    description: exam.description,
    status: exam.status,
    durationMinutes: exam.durationMinutes,
    opensAt: exam.opensAt,
    closesAt: exam.closesAt,
    maxAttempts: exam.maxAttempts,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    showTimer: exam.showTimer,
    accessToken: exam.accessToken,
    showScore: exam.showScore,
    showReview: exam.showReview,
    /** Questions cannot change once anyone has started: that would change scores retroactively. */
    locked: n > 0,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      explanation: q.explanation,
      points: q.points,
      options: options.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text, correct: o.isCorrect })),
    })),
  });
}

/** Checks one question's shape against its type. Returns an error message or null. */
export function validateQuestion(q: QuestionInput, index: number): string | null {
  const label = `Pertanyaan ${index + 1}`;
  const correct = q.options.filter((o) => o.correct).length;
  if (q.type === "essay") return q.options.length ? `${label}: esai tidak memakai pilihan jawaban` : null;
  if (q.options.some((o) => !o.text.trim())) return `${label}: pilihan jawaban tidak boleh kosong`;
  if (q.type === "truefalse") return q.options.length === 2 && correct === 1 ? null : `${label}: pilih satu jawaban yang benar (Benar atau Salah)`;
  if (q.options.length < 2 || q.options.length > 8) return `${label}: butuh 2 sampai 8 pilihan jawaban`;
  if (q.type === "single") return correct === 1 ? null : `${label}: pilih tepat satu jawaban yang benar`;
  return correct >= 1 ? null : `${label}: pilih minimal satu jawaban yang benar`; // multiple
}

/** Replaces the whole question list in one transaction (the editor saves everything at once). */
export async function replaceQuestions(v: Viewer, id: number, questions: QuestionInput[]): Promise<Result<true>> {
  const loaded = await loadManagedExam(v, id);
  if (!loaded.ok) return loaded;
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(examAttempts).where(eq(examAttempts.examId, id))) as [{ n: number }];
  if (n > 0) return fail(409, "Pertanyaan tidak bisa diubah karena sudah ada siswa yang mulai mengerjakan");
  for (const [i, q] of questions.entries()) {
    const problem = validateQuestion(q, i);
    if (problem) return fail(422, problem);
  }
  if (questions.length === 0 && loaded.value.status === "published") return fail(422, "Ujian yang sudah terbit harus punya minimal satu pertanyaan");

  await db.transaction(async (tx) => {
    await tx.delete(examQuestions).where(eq(examQuestions.examId, id)); // options cascade
    for (const [i, q] of questions.entries()) {
      const [row] = await tx
        .insert(examQuestions)
        .values({ examId: id, position: i, type: q.type, text: q.text.trim(), explanation: q.explanation.trim(), points: q.points })
        .returning({ id: examQuestions.id });
      const opts = q.type === "truefalse" ? [{ text: "Benar", correct: q.options[0]!.correct }, { text: "Salah", correct: q.options[1]!.correct }] : q.options;
      if (opts.length) await tx.insert(examOptions).values(opts.map((o, j) => ({ questionId: row!.id, position: j, text: o.text.trim(), isCorrect: o.correct })));
    }
  });
  return ok(true);
}
