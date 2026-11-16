export type ClassSystem = "homeroom_teacher" | "subject_teachers";

export interface Teacher {
  id: number;
  name: string;
  username: string;
}

export interface Subject {
  id: number;
  name: string;
}

export interface Room {
  id: number;
  name: string;
  /** The teacher whose own subject room this is (moving class); null = shared. */
  ownerId: number | null;
  ownerName: string | null;
}

export interface ClassSummary {
  id: number;
  name: string;
  grade: string | null;
  system: ClassSystem;
  homeroomTeacherId: number | null;
  homeroomTeacherName: string | null;
  memberCount: number;
}

export interface ClassSubject {
  subjectId: number;
  name: string;
  /** Set when the subject has its own teacher; null = the homeroom teacher teaches it. */
  teacherId: number | null;
  teacherName: string | null;
  inherited: boolean;
  effectiveTeacherId: number | null;
  effectiveTeacherName: string | null;
}

export interface Lesson {
  id: number;
  classroomId: number;
  subjectId: number;
  subjectName: string;
  /** 1 = Monday .. 7 = Sunday. */
  weekday: number;
  /** Minutes after midnight. */
  startMin: number;
  endMin: number;
  /** null = the class stays in its own room; set = the class moves to this room. */
  roomId: number | null;
  roomName: string | null;
  teacherId: number | null;
  teacherName: string | null;
}

/** Lessons from "my schedule" also say which class they belong to. */
export interface ScheduleLesson extends Lesson {
  classroomName: string;
}

export interface ClassDetail extends Omit<ClassSummary, "memberCount"> {
  memberCount: number;
  subjects: ClassSubject[];
  lessons: Lesson[];
}

export interface ClassInput {
  name: string;
  grade: string | null;
  homeroomTeacherId: number | null;
}

export interface LessonInput {
  weekday: number;
  startMin: number;
  endMin: number;
  roomId: number | null;
}
