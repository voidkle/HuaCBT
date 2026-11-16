export type SubmissionStatus = "missing" | "submitted" | "graded";

export const MAX_FILES = 5;
export const MAX_TEXT = 10_000;

export interface FileInfo {
  id: number;
  name: string;
  size: number;
}

/** A class and the subjects in it that the viewer may post homework for. */
export interface Target {
  classroomId: number;
  classroomName: string;
  subjects: { id: number; name: string }[];
}

export interface MyStatus {
  status: SubmissionStatus;
  late: boolean;
  score: number | null;
}

export interface Counts {
  total: number;
  submitted: number;
  graded: number;
}

export interface Assignment {
  id: number;
  classroomId: number;
  classroomName: string;
  subjectId: number;
  subjectName: string;
  title: string;
  instructions: string;
  dueAt: Date;
  allowLate: boolean;
  maxPoints: number;
  createdAt: Date;
  teacherId: number | null;
  teacherName: string | null;
  canManage: boolean;
  /** Students only. */
  mine: MyStatus | null;
  /** Teachers and admins only. */
  counts: Counts | null;
}

export interface MySubmission {
  id: number;
  text: string;
  submittedAt: Date;
  late: boolean;
  status: SubmissionStatus;
  score: number | null;
  feedback: string | null;
  gradedAt: Date | null;
  files: FileInfo[];
}

export interface AssignmentDetail extends Omit<Assignment, "mine" | "counts"> {
  files: FileInfo[];
  mine: MySubmission | null;
}

export interface RosterRow {
  id: number;
  name: string;
  username: string;
  submissionId: number | null;
  status: SubmissionStatus;
  submittedAt: Date | null;
  late: boolean;
  score: number | null;
}

export interface SubmissionDetail extends MySubmission {
  student: { id: number; name: string; username: string };
  assignment: { id: number; title: string; maxPoints: number };
}

export interface AssignmentInput {
  title: string;
  instructions: string;
  /** ISO date-time. */
  dueAt: string;
  allowLate: boolean;
  maxPoints: number;
}

export interface NewAssignment extends AssignmentInput {
  classroomId: number;
  subjectId: number;
}

export interface SubmissionInput {
  text: string;
  /** Ids of files already attached that stay; the rest are dropped. */
  keep: number[];
  files: File[];
}
