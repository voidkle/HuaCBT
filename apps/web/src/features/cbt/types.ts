/** Eden parses ISO strings into Date for REST responses; accept both everywhere. */
export type Ts = string | Date;

export type QuestionType = "single" | "multiple" | "truefalse" | "essay";

export const questionTypeLabels: Record<QuestionType, string> = {
  single: "Pilihan ganda",
  multiple: "Pilihan ganda (banyak jawaban)",
  truefalse: "Benar / Salah",
  essay: "Esai",
};

export const MAX_OPTIONS = 8;
export const MIN_OPTIONS = 2;
export const ESSAY_MAX = 20000;
export const MAX_QUESTIONS = 200;

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

// ---------------------------------------------------------------- manager

export interface ManagedExam {
  id: number;
  title: string;
  status: "draft" | "published";
  durationMinutes: number | null;
  opensAt: Ts | null;
  closesAt: Ts | null;
  maxAttempts: number;
  createdAt: Ts;
  ownerId: number | null;
  ownerName: string | null;
  questionCount: number;
  totalPoints: number;
  attempts: number;
  needsGrading: number;
}

export interface EditorOption {
  text: string;
  correct: boolean;
}

export interface EditorQuestion {
  /** Client-only identity so rows keep their state while reordering. */
  key: string;
  type: QuestionType;
  text: string;
  explanation: string;
  points: number;
  options: EditorOption[];
}

export interface EditorExam extends ExamSettings {
  id: number;
  status: "draft" | "published";
  /** True once anyone started: the questions can no longer change. */
  locked: boolean;
  questions: { id: number; type: QuestionType; text: string; explanation: string; points: number; options: { id: number; text: string; correct: boolean }[] }[];
}

export interface AttemptRow {
  id: number;
  studentId: number;
  name: string;
  username: string;
  attemptNo: number;
  status: "in_progress" | "submitted";
  startedAt: Ts;
  submittedAt: Ts | null;
  autoScore: number;
  essayScore: number;
  maxScore: number;
  total: number;
  percent: number;
  graded: boolean;
  ungraded: number;
}

export interface ReviewQuestion {
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

export interface GradingView {
  attemptId: number;
  exam: { id: number; title: string };
  student: { id: number; name: string; username: string } | null;
  attemptNo: number;
  status: "in_progress" | "submitted";
  submittedAt: Ts | null;
  graded: boolean;
  autoScore: number;
  essayScore: number;
  total: number;
  max: number;
  percent: number;
  questions: ReviewQuestion[];
}

// ---------------------------------------------------------------- student

export interface AvailableExam {
  id: number;
  title: string;
  description: string;
  durationMinutes: number | null;
  opensAt: Ts | null;
  closesAt: Ts | null;
  maxAttempts: number;
  requiresToken: boolean;
  showTimer: boolean;
  questionCount: number;
  totalPoints: number;
  window: "upcoming" | "open" | "closed";
  attemptsUsed: number;
  inProgressAttemptId: number | null;
  lastAttemptId: number | null;
  canStart: boolean;
}

export interface PlayQuestion {
  id: number;
  type: QuestionType;
  text: string;
  points: number;
  options: { id: number; text: string }[];
}

export interface Answer {
  selected: number[];
  essayText: string;
  flagged: boolean;
}

export type AttemptView =
  | { status: "submitted"; attemptId: number }
  | {
      status: "in_progress";
      attemptId: number;
      exam: { id: number; title: string; description: string; showTimer: boolean; durationMinutes: number | null };
      startedAt: Ts;
      deadlineAt: Ts | null;
      serverNow: Ts;
      questions: PlayQuestion[];
      answers: Record<number, Answer>;
    };

export interface ResultView {
  attemptId: number;
  exam: { id: number; title: string; showScore: boolean; showReview: boolean };
  attemptNo: number;
  submittedAt: Ts | null;
  graded: boolean;
  score: { total: number; max: number; percent: number } | null;
  review: ReviewQuestion[] | null;
}

export interface ImportPreview {
  questions: Omit<EditorQuestion, "key">[];
  errors: { row: number; message: string }[];
}
