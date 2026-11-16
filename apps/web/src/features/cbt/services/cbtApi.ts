import { API_URL, api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { Answer, AttemptRow, AttemptView, AvailableExam, EditorExam, ExamSettings, GradingView, ImportPreview, ManagedExam, ResultView } from "../types";

// ---- managers
export const fetchManaged = async () => unwrap<ManagedExam[]>(await api.cbt.manage.get());
export const createExam = async (settings: ExamSettings) => unwrap<{ id: number }>(await api.cbt.exams.post(settings));
export const fetchEditorExam = async (id: number) => unwrap<EditorExam>(await api.cbt.exams({ id }).get());
export const updateExam = async (id: number, patch: Partial<ExamSettings>) => unwrap<true>(await api.cbt.exams({ id }).patch(patch));
export const deleteExam = async (id: number) => unwrap<true>(await api.cbt.exams({ id }).delete());
export const saveQuestions = async (id: number, questions: { type: string; text: string; explanation: string; points: number; options: { text: string; correct: boolean }[] }[]) =>
  unwrap<true>(await api.cbt.exams({ id }).questions.put({ questions: questions as never }));
export const setPublished = async (id: number, published: boolean) => unwrap<true>(await api.cbt.exams({ id }).publish.post({ published }));
export const fetchAttempts = async (id: number) => unwrap<{ exam: { id: number; title: string }; attempts: AttemptRow[] }>(await api.cbt.exams({ id }).attempts.get());
export const fetchGrading = async (attemptId: number) => unwrap<GradingView>(await api.cbt.attempts({ id: attemptId }).grading.get());
export const gradeEssay = async (attemptId: number, questionId: number, score: number, feedback: string) =>
  unwrap<{ essayScore: number; total: number; graded: boolean }>(await api.cbt.attempts({ id: attemptId }).grade({ qid: questionId }).put({ score, feedback }));

/** A plain link: the browser downloads the CSV with the session cookie. */
export const exportUrl = (examId: number) => `${API_URL}/cbt/exams/${examId}/export`;

/** A plain link, like the CSV export: the browser downloads the .xlsx template with the session cookie. */
export const importTemplateUrl = `${API_URL}/cbt/import/template`;
export const previewImport = async (file: File) => unwrap<ImportPreview>(await api.cbt.import.preview.post({ file }));

// ---- students
export const fetchAvailable = async () => unwrap<AvailableExam[]>(await api.cbt.available.get());
export const startAttempt = async (examId: number, token?: string) => unwrap<{ attemptId: number }>(await api.cbt.exams({ id: examId }).start.post(token ? { token } : {}));
export const fetchAttempt = async (attemptId: number) => unwrap<AttemptView>(await api.cbt.attempts({ id: attemptId }).get());
export const saveAnswer = async (attemptId: number, questionId: number, answer: Partial<Answer>) =>
  unwrap<{ savedAt: string | Date }>(await api.cbt.attempts({ id: attemptId }).answers({ qid: questionId }).put(answer));
export const submitAttempt = async (attemptId: number) => unwrap<{ attemptId: number }>(await api.cbt.attempts({ id: attemptId }).submit.post());
export const fetchResult = async (attemptId: number) => unwrap<ResultView>(await api.cbt.attempts({ id: attemptId }).result.get());
