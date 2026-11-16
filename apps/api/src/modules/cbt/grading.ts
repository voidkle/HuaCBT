import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { examAnswers, examAttempts, examOptions, examQuestions, exams, users } from "../../db/schema";
import { finalizeExpired } from "./attempts";
import { loadManagedExam } from "./exams";
import { fail, ok, type Result, type Viewer } from "./result";
import { round2 } from "./scoring";

const percentOf = (total: number, max: number) => (max ? round2((total / max) * 100) : 0);

/** All submitted and running attempts of an exam, for the results table. */
export async function listAttempts(v: Viewer, examId: number) {
  const exam = await loadManagedExam(v, examId);
  if (!exam.ok) return exam;
  await finalizeExpired({ examId }); // abandoned attempts past their deadline count as submitted
  const rows = await db
    .select({
      id: examAttempts.id,
      studentId: examAttempts.studentId,
      name: users.name,
      username: users.username,
      attemptNo: examAttempts.attemptNo,
      status: examAttempts.status,
      startedAt: examAttempts.startedAt,
      submittedAt: examAttempts.submittedAt,
      autoScore: examAttempts.autoScore,
      essayScore: examAttempts.essayScore,
      maxScore: examAttempts.maxScore,
      gradedAt: examAttempts.gradedAt,
      ungraded: sql<number>`(select count(*)::int from exam_answers a join exam_questions q on q.id = a.question_id where a.attempt_id = ${examAttempts.id} and q.type = 'essay' and a.score is null)`,
    })
    .from(examAttempts)
    .innerJoin(users, eq(examAttempts.studentId, users.id))
    .where(eq(examAttempts.examId, examId))
    .orderBy(users.name, examAttempts.attemptNo);
  return ok({
    exam: { id: exam.value.id, title: exam.value.title },
    attempts: rows.map((r) => {
      const total = round2(r.autoScore + r.essayScore);
      return { ...r, total, percent: percentOf(total, r.maxScore), graded: r.gradedAt !== null };
    }),
  });
}

/** One attempt with everything a grader needs: the questions, the right answers, what the student answered. */
export async function getGradingView(v: Viewer, attemptId: number) {
  const [attempt] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId));
  if (!attempt) return fail(404, "Percobaan tidak ditemukan");
  const exam = await loadManagedExam(v, attempt.examId);
  if (!exam.ok) return exam;
  if (attempt.status === "in_progress" && attempt.deadlineAt && attempt.deadlineAt.getTime() < Date.now() - 5000) {
    await finalizeExpired({ examId: attempt.examId });
    return getGradingView(v, attemptId);
  }

  const [student] = await db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(eq(users.id, attempt.studentId));
  const qs = await db.select().from(examQuestions).where(eq(examQuestions.examId, attempt.examId)).orderBy(examQuestions.position);
  const opts = qs.length ? await db.select().from(examOptions).where(inArray(examOptions.questionId, qs.map((q) => q.id))).orderBy(examOptions.position) : [];
  const answers = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));
  const total = round2(attempt.autoScore + attempt.essayScore);
  return ok({
    attemptId,
    exam: { id: exam.value.id, title: exam.value.title },
    student: student ?? null,
    attemptNo: attempt.attemptNo,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    graded: attempt.gradedAt !== null,
    autoScore: attempt.autoScore,
    essayScore: attempt.essayScore,
    total,
    max: attempt.maxScore,
    percent: percentOf(total, attempt.maxScore),
    questions: qs.map((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      return {
        id: q.id,
        type: q.type,
        text: q.text,
        points: q.points,
        explanation: q.explanation,
        options: opts.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text, correct: o.isCorrect })),
        selected: a?.selected ?? [],
        essayText: a?.essayText ?? "",
        score: a?.score ?? null,
        feedback: a?.feedback ?? "",
      };
    }),
  });
}

export async function gradeEssay(v: Viewer, attemptId: number, questionId: number, score: number, feedback: string): Promise<Result<{ essayScore: number; total: number; graded: boolean }>> {
  const [attempt] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId));
  if (!attempt) return fail(404, "Percobaan tidak ditemukan");
  const exam = await loadManagedExam(v, attempt.examId);
  if (!exam.ok) return exam;
  if (attempt.status !== "submitted") return fail(409, "Percobaan belum dikumpulkan");
  const [question] = await db.select().from(examQuestions).where(and(eq(examQuestions.id, questionId), eq(examQuestions.examId, attempt.examId)));
  if (!question) return fail(404, "Pertanyaan tidak ditemukan");
  if (question.type !== "essay") return fail(422, "Hanya esai yang dinilai manual");
  if (score < 0 || score > question.points) return fail(422, `Nilai harus antara 0 dan ${question.points}`);

  return db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .insert(examAnswers)
      .values({ attemptId, questionId, score: round2(score), feedback: feedback.trim(), gradedBy: v.id, gradedAt: now })
      .onConflictDoUpdate({ target: [examAnswers.attemptId, examAnswers.questionId], set: { score: round2(score), feedback: feedback.trim(), gradedBy: v.id, gradedAt: now } });
    // totals are recomputed from the answers (never incremented): regrading and double submits stay correct
    const [agg] = await tx
      .select({ essay: sql<number>`coalesce(sum(a.score), 0)::float8`, ungraded: sql<number>`count(*) filter (where a.score is null)::int` })
      .from(sql`exam_answers a join exam_questions q on q.id = a.question_id`)
      .where(sql`a.attempt_id = ${attemptId} and q.type = 'essay'`);
    const essayScore = round2(agg!.essay);
    const graded = agg!.ungraded === 0;
    await tx.update(examAttempts).set({ essayScore, gradedAt: graded ? (attempt.gradedAt ?? now) : null }).where(eq(examAttempts.id, attemptId));
    return ok({ essayScore, total: round2(attempt.autoScore + essayScore), graded });
  });
}

// ---------------------------------------------------------------- export

/** A cell that starts with = + - @ would run as a formula when the CSV is opened in Excel; neutralize it. */
const cell = (value: string | number | null | undefined): string => {
  let s = value == null ? "" : String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportCsv(v: Viewer, examId: number): Promise<Result<{ filename: string; csv: string }>> {
  const data = await listAttempts(v, examId);
  if (!data.ok) return data;
  const iso = (d: Date | null) => (d ? d.toISOString().replace("T", " ").slice(0, 19) : "");
  const header = ["Nama", "Username", "Percobaan", "Status", "Mulai (UTC)", "Dikumpulkan (UTC)", "Nilai pilihan ganda", "Nilai esai", "Total", "Maksimum", "Persen", "Penilaian"];
  const lines = [header, ...data.value.attempts.map((a) => [a.name, a.username, a.attemptNo, a.status === "submitted" ? "Dikumpulkan" : "Berjalan", iso(a.startedAt), iso(a.submittedAt), a.autoScore, a.essayScore, a.total, a.maxScore, a.percent, a.graded ? "Selesai" : a.status === "submitted" ? `Menunggu (${a.ungraded} esai)` : ""])];
  const safeTitle = data.value.exam.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "ujian";
  return ok({ filename: `nilai-${safeTitle}.csv`, csv: `﻿${lines.map((l) => l.map(cell).join(",")).join("\r\n")}\r\n` });
}
