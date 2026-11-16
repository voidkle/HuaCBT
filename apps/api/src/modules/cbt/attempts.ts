import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../../db";
import { examAnswers, examAttempts, examOptions, examQuestions, exams, type QuestionType } from "../../db/schema";
import { fail, ok, outerExamId, type Result, type Viewer } from "./result";
import { round2, scoreChoice } from "./scoring";
import { mix, seededShuffle } from "./shuffle";

/** Answers arriving this long after the deadline are still accepted (network lag on the final autosave). */
const GRACE_MS = 5000;

type Exam = typeof exams.$inferSelect;
type Attempt = typeof examAttempts.$inferSelect;

const windowOf = (e: Pick<Exam, "opensAt" | "closesAt">, now: Date): "upcoming" | "open" | "closed" =>
  e.opensAt && now < e.opensAt ? "upcoming" : e.closesAt && now >= e.closesAt ? "closed" : "open";

// ---------------------------------------------------------------- finalizing (scoring)

/**
 * Closes an attempt and scores it: choice questions immediately, blank essays as 0, everything else waits for a teacher.
 * Safe to call twice or concurrently: only the call that flips in_progress -> submitted does the work.
 */
export async function finalizeAttempt(attemptId: number, submittedAt: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [attempt] = await tx.update(examAttempts).set({ status: "submitted", submittedAt }).where(and(eq(examAttempts.id, attemptId), eq(examAttempts.status, "in_progress"))).returning();
    if (!attempt) return;

    const questions = await tx.select().from(examQuestions).where(eq(examQuestions.examId, attempt.examId));
    const options = questions.length ? await tx.select().from(examOptions).where(inArray(examOptions.questionId, questions.map((q) => q.id))) : [];
    const answers = await tx.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));

    let auto = 0;
    let pendingEssays = 0;
    const rows: (typeof examAnswers.$inferInsert)[] = [];
    for (const q of questions) {
      const ans = answers.find((a) => a.questionId === q.id);
      if (q.type === "essay") {
        if (ans && ans.essayText.trim() !== "") {
          pendingEssays++; // waits for a teacher
          if (ans.score === null) continue;
        }
        rows.push({ attemptId, questionId: q.id, selected: [], essayText: ans?.essayText ?? "", score: ans?.score ?? 0, gradedAt: ans?.gradedAt ?? submittedAt });
        continue;
      }
      const correct = options.filter((o) => o.questionId === q.id && o.isCorrect).map((o) => o.id);
      const score = scoreChoice(q.type, correct, ans?.selected ?? [], q.points);
      auto += score;
      rows.push({ attemptId, questionId: q.id, selected: ans?.selected ?? [], essayText: "", score });
    }
    if (rows.length) {
      await tx.insert(examAnswers).values(rows).onConflictDoUpdate({ target: [examAnswers.attemptId, examAnswers.questionId], set: { score: sql`excluded.score`, gradedAt: sql`coalesce(${examAnswers.gradedAt}, excluded.graded_at)` } });
    }
    await tx.update(examAttempts).set({ autoScore: round2(auto), essayScore: 0, gradedAt: pendingEssays === 0 ? submittedAt : null }).where(eq(examAttempts.id, attemptId));
  });
}

/** Attempts whose deadline has passed but were never submitted (tab closed, laptop died) are finalized lazily. */
export async function finalizeExpired(filter: { examId?: number; studentId?: number }) {
  const expired = await db
    .select({ id: examAttempts.id, deadlineAt: examAttempts.deadlineAt })
    .from(examAttempts)
    .where(and(eq(examAttempts.status, "in_progress"), isNotNull(examAttempts.deadlineAt), lt(examAttempts.deadlineAt, new Date(Date.now() - GRACE_MS)), filter.examId ? eq(examAttempts.examId, filter.examId) : undefined, filter.studentId ? eq(examAttempts.studentId, filter.studentId) : undefined));
  for (const a of expired) await finalizeAttempt(a.id, a.deadlineAt!); // the time spent is capped at the deadline
}

// ---------------------------------------------------------------- listing for students

export async function listAvailable(student: Viewer) {
  await finalizeExpired({ studentId: student.id });
  const now = new Date();
  const rows = await db
    .select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      durationMinutes: exams.durationMinutes,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      maxAttempts: exams.maxAttempts,
      requiresToken: sql<boolean>`${exams.accessToken} is not null`,
      showTimer: exams.showTimer,
      questionCount: sql<number>`(select count(*)::int from exam_questions q where q.exam_id = ${outerExamId})`,
      totalPoints: sql<number>`(select coalesce(sum(q.points), 0)::int from exam_questions q where q.exam_id = ${outerExamId})`,
    })
    .from(exams)
    .where(eq(exams.status, "published"))
    .orderBy(sql`${exams.opensAt} desc nulls last`, exams.id);

  const mine = await db.select().from(examAttempts).where(eq(examAttempts.studentId, student.id)).orderBy(examAttempts.attemptNo);
  return rows
    .map((e) => {
      const attempts = mine.filter((a) => a.examId === e.id);
      const inProgress = attempts.find((a) => a.status === "in_progress");
      const lastSubmitted = [...attempts].reverse().find((a) => a.status === "submitted");
      const window = windowOf(e, now);
      return {
        ...e,
        window,
        attemptsUsed: attempts.length,
        inProgressAttemptId: inProgress?.id ?? null,
        lastAttemptId: lastSubmitted?.id ?? null,
        canStart: window === "open" && (inProgress !== undefined || attempts.length < e.maxAttempts),
      };
    })
    .filter((e) => e.window !== "closed" || e.attemptsUsed > 0); // a closed exam you never took is just noise
}

// ---------------------------------------------------------------- starting

const tokenMatches = (expected: string, given: string) => {
  const a = Buffer.from(expected.trim().toUpperCase());
  const b = Buffer.from(given.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function startAttempt(student: Viewer, examId: number, token: string | undefined): Promise<Result<{ attemptId: number }>> {
  const [exam] = await db.select().from(exams).where(and(eq(exams.id, examId), eq(exams.status, "published")));
  if (!exam) return fail(404, "Ujian tidak ditemukan");
  await finalizeExpired({ studentId: student.id }); // an abandoned, expired attempt must not block a new one

  const existing = await db.select().from(examAttempts).where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, student.id))).orderBy(examAttempts.attemptNo);
  const running = existing.find((a) => a.status === "in_progress");
  if (running) return ok({ attemptId: running.id }); // resume: no token, no new attempt

  const now = new Date();
  const w = windowOf(exam, now);
  if (w === "upcoming") return fail(409, "Ujian belum dibuka");
  if (w === "closed") return fail(409, "Ujian sudah ditutup");
  if (existing.length >= exam.maxAttempts) return fail(409, "Kesempatan mengerjakan sudah habis");
  if (exam.accessToken && !(token && tokenMatches(exam.accessToken, token))) return fail(403, "Token ujian salah");

  const [{ n, points }] = (await db.select({ n: sql<number>`count(*)::int`, points: sql<number>`coalesce(sum(${examQuestions.points}), 0)::int` }).from(examQuestions).where(eq(examQuestions.examId, examId))) as [{ n: number; points: number }];
  if (n === 0) return fail(409, "Ujian belum memiliki pertanyaan");

  const byDuration = exam.durationMinutes ? new Date(now.getTime() + exam.durationMinutes * 60_000) : null;
  const deadlineAt = byDuration && exam.closesAt ? (byDuration < exam.closesAt ? byDuration : exam.closesAt) : (byDuration ?? exam.closesAt);
  try {
    const [row] = await db
      .insert(examAttempts)
      .values({ examId, studentId: student.id, attemptNo: existing.length + 1, seed: crypto.getRandomValues(new Int32Array(1))[0]!, startedAt: now, deadlineAt, maxScore: points }) // startedAt from the app clock, like deadline/submit (the DB server's clock may differ)
      .returning({ id: examAttempts.id });
    return ok({ attemptId: row!.id });
  } catch {
    // double click: the unique (exam, student, attemptNo) index stopped the second insert; hand back the first
    const [again] = await db.select().from(examAttempts).where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, student.id), eq(examAttempts.status, "in_progress")));
    return again ? ok({ attemptId: again.id }) : fail(409, "Tidak bisa memulai ujian, coba lagi");
  }
}

// ---------------------------------------------------------------- taking

async function ownAttempt(student: Viewer, attemptId: number): Promise<Attempt | null> {
  const [a] = await db.select().from(examAttempts).where(and(eq(examAttempts.id, attemptId), eq(examAttempts.studentId, student.id)));
  return a ?? null;
}

/** Closes the attempt if its deadline (plus grace) has passed. Returns true when it did. */
async function expireIfNeeded(a: Attempt, now = new Date()): Promise<boolean> {
  if (a.status !== "in_progress" || !a.deadlineAt || now.getTime() <= a.deadlineAt.getTime() + GRACE_MS) return false;
  await finalizeAttempt(a.id, a.deadlineAt);
  return true;
}

export type AttemptView =
  | { status: "submitted"; attemptId: number }
  | {
      status: "in_progress";
      attemptId: number;
      exam: { id: number; title: string; description: string; showTimer: boolean; durationMinutes: number | null };
      startedAt: Date;
      deadlineAt: Date | null;
      /** Server clock, so the browser can correct its own (a wrong laptop clock must not change the timer). */
      serverNow: Date;
      questions: { id: number; type: QuestionType; text: string; points: number; options: { id: number; text: string }[] }[];
      answers: Record<number, { selected: number[]; essayText: string; flagged: boolean }>;
    };

/** The running exam for the student: questions in this attempt's order, WITHOUT any correct-answer information. */
export async function loadAttempt(student: Viewer, attemptId: number): Promise<Result<AttemptView>> {
  const attempt = await ownAttempt(student, attemptId);
  if (!attempt) return fail(404, "Ujian tidak ditemukan");
  if (await expireIfNeeded(attempt)) return ok({ status: "submitted", attemptId });
  if (attempt.status === "submitted") return ok({ status: "submitted", attemptId });

  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId));
  const qs = await db.select().from(examQuestions).where(eq(examQuestions.examId, attempt.examId)).orderBy(examQuestions.position);
  const opts = qs.length ? await db.select({ id: examOptions.id, questionId: examOptions.questionId, text: examOptions.text }).from(examOptions).where(inArray(examOptions.questionId, qs.map((q) => q.id))).orderBy(examOptions.position) : [];
  const saved = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));

  const ordered = exam!.shuffleQuestions ? seededShuffle(qs, attempt.seed) : qs;
  return ok({
    status: "in_progress",
    attemptId,
    exam: { id: exam!.id, title: exam!.title, description: exam!.description, showTimer: exam!.showTimer, durationMinutes: exam!.durationMinutes },
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    serverNow: new Date(),
    questions: ordered.map((q) => {
      const own = opts.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, text: o.text }));
      const shuffle = exam!.shuffleOptions && (q.type === "single" || q.type === "multiple"); // true/false stays Benar, Salah
      return { id: q.id, type: q.type, text: q.text, points: q.points, options: shuffle ? seededShuffle(own, mix(attempt.seed, q.id)) : own };
    }),
    answers: Object.fromEntries(saved.map((a) => [a.questionId, { selected: a.selected, essayText: a.essayText, flagged: a.flagged }])),
  });
}

export interface AnswerInput {
  selected?: number[];
  essayText?: string;
  flagged?: boolean;
}

export async function saveAnswer(student: Viewer, attemptId: number, questionId: number, input: AnswerInput): Promise<Result<{ savedAt: Date }>> {
  const attempt = await ownAttempt(student, attemptId);
  if (!attempt) return fail(404, "Ujian tidak ditemukan");
  if (attempt.status === "submitted" || (await expireIfNeeded(attempt))) return fail(409, "Waktu habis atau ujian sudah dikumpulkan");

  const [question] = await db.select().from(examQuestions).where(and(eq(examQuestions.id, questionId), eq(examQuestions.examId, attempt.examId)));
  if (!question) return fail(404, "Pertanyaan tidak ditemukan");

  if (input.selected !== undefined) {
    if (question.type === "essay") return fail(422, "Pertanyaan esai tidak memakai pilihan");
    const valid = new Set((await db.select({ id: examOptions.id }).from(examOptions).where(eq(examOptions.questionId, questionId))).map((o) => o.id));
    const unique = [...new Set(input.selected)];
    if (unique.some((id) => !valid.has(id))) return fail(422, "Pilihan tidak valid");
    if (question.type !== "multiple" && unique.length > 1) return fail(422, "Pilih satu jawaban saja");
    input.selected = unique;
  }
  if (input.essayText !== undefined && question.type !== "essay") return fail(422, "Pertanyaan ini bukan esai");

  const now = new Date();
  const set = { ...(input.selected !== undefined && { selected: input.selected }), ...(input.essayText !== undefined && { essayText: input.essayText }), ...(input.flagged !== undefined && { flagged: input.flagged }), updatedAt: now };
  await db
    .insert(examAnswers)
    .values({ attemptId, questionId, selected: input.selected ?? [], essayText: input.essayText ?? "", flagged: input.flagged ?? false, updatedAt: now })
    .onConflictDoUpdate({ target: [examAnswers.attemptId, examAnswers.questionId], set });
  return ok({ savedAt: now });
}

export async function submitAttempt(student: Viewer, attemptId: number): Promise<Result<{ attemptId: number }>> {
  const attempt = await ownAttempt(student, attemptId);
  if (!attempt) return fail(404, "Ujian tidak ditemukan");
  if (attempt.status === "in_progress") await finalizeAttempt(attemptId, new Date()); // idempotent when already submitted
  return ok({ attemptId });
}

// ---------------------------------------------------------------- results

export interface ReviewItem {
  id: number;
  type: QuestionType;
  text: string;
  points: number;
  explanation: string;
  options: { id: number; text: string; correct: boolean }[];
  selected: number[];
  essayText: string;
  score: number | null;
  feedback: string;
}

export interface ResultView {
  attemptId: number;
  exam: { id: number; title: string; showScore: boolean; showReview: boolean };
  attemptNo: number;
  submittedAt: Date | null;
  graded: boolean;
  score: { total: number; max: number; percent: number } | null;
  review: ReviewItem[] | null;
}

export async function getResult(student: Viewer, attemptId: number): Promise<Result<ResultView>> {
  let attempt = await ownAttempt(student, attemptId);
  if (!attempt) return fail(404, "Hasil tidak ditemukan");
  if (await expireIfNeeded(attempt)) attempt = (await ownAttempt(student, attemptId))!;
  if (attempt.status !== "submitted") return fail(409, "Ujian belum dikumpulkan");

  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId));
  const graded = attempt.gradedAt !== null;
  const total = round2(attempt.autoScore + attempt.essayScore);
  const base = {
    attemptId,
    exam: { id: exam!.id, title: exam!.title, showScore: exam!.showScore, showReview: exam!.showReview },
    attemptNo: attempt.attemptNo,
    submittedAt: attempt.submittedAt,
    graded,
    // the score is only revealed once every essay is graded, and only if the teacher allows it
    score: graded && exam!.showScore ? { total, max: attempt.maxScore, percent: attempt.maxScore ? round2((total / attempt.maxScore) * 100) : 0 } : null,
  };
  if (!(graded && exam!.showReview)) return ok({ ...base, review: null });

  const qs = await db.select().from(examQuestions).where(eq(examQuestions.examId, attempt.examId)).orderBy(examQuestions.position);
  const opts = qs.length ? await db.select().from(examOptions).where(inArray(examOptions.questionId, qs.map((q) => q.id))).orderBy(examOptions.position) : [];
  const answers = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));
  return ok({
    ...base,
    review: qs.map((q) => {
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
