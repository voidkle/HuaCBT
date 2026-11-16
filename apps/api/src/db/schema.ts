import { sql } from "drizzle-orm";
import { bigint, boolean, check, doublePrecision, foreignKey, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const roles = ["admin", "operator", "teacher", "staff", "student"] as const;
export type Role = (typeof roles)[number];
export const roleEnum = pgEnum("role", roles);

export const users = pgTable("users", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  ssoId: bigint({ mode: "number" }).notNull().unique("users_sso_id_unique"), // TekSso user id
  username: text().notNull(),
  name: text().notNull(),
  email: text(),
  role: roleEnum().notNull().default("student"),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow().$onUpdate(() => new Date()),
});

/** Key/value app configuration (see modules/config for the keys and defaults). */
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const noticeStatuses = ["pending", "approved", "rejected"] as const;
export type NoticeStatus = (typeof noticeStatuses)[number];
export const noticeStatusEnum = pgEnum("notice_status", noticeStatuses);

/** Mading (school bulletin board). Student/teacher posts start `pending` until staff/admin/operator approves. */
export const notices = pgTable("notices", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  body: text().notNull(),
  authorId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  status: noticeStatusEnum().notNull().default("pending"),
  reviewedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  reviewNote: text(),
  reviewedAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow().$onUpdate(() => new Date()),
});

/** E-book library (PDF files live in UPLOAD_DIR/ebooks/<id>.pdf, covers in <id>.cover). */
export const ebooks = pgTable("ebooks", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  description: text().notNull().default(""),
  sizeBytes: bigint({ mode: "number" }).notNull(),
  pageCount: integer().notNull(), // reported by the uploading browser (pdf.js); informational
  coverMime: text(), // null = no cover
  uploadedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp().notNull().defaultNow(),
});

/** Last page each user read in each book. */
export const ebookProgress = pgTable(
  "ebook_progress",
  {
    userId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    ebookId: bigint({ mode: "number" }).notNull().references(() => ebooks.id, { onDelete: "cascade" }),
    page: integer().notNull(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.ebookId] })],
);

export const chatRoomTypeEnum = pgEnum("chat_room_type", ["direct", "group"]);

export const chatRooms = pgTable("chat_rooms", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  type: chatRoomTypeEnum().notNull(),
  name: text(), // groups only; a direct chat is named after the other person
  directKey: text().unique(), // "<lowerUserId>:<higherUserId>" so two people share exactly one direct chat
  createdBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  lastMessageAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const chatMembers = pgTable(
  "chat_members",
  {
    roomId: bigint({ mode: "number" }).notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
    userId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadMessageId: bigint({ mode: "number" }), // unread = messages newer than this
    joinedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.userId] }), index("chat_members_user_idx").on(t.userId)],
);

export const chatAttachmentKinds = ["image", "video", "audio", "file"] as const;
export type ChatAttachmentKind = (typeof chatAttachmentKinds)[number];
export const chatAttachmentKindEnum = pgEnum("chat_attachment_kind", chatAttachmentKinds);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    roomId: bigint({ mode: "number" }).notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
    senderId: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    body: text().notNull().default(""),
    attachmentKind: chatAttachmentKindEnum(), // file stored at UPLOAD_DIR/chat/<id>
    attachmentName: text(),
    attachmentMime: text(),
    attachmentSize: bigint({ mode: "number" }),
    linkType: text(), // "ebook" for now; video/slide links plug in here later
    linkRef: bigint({ mode: "number" }),
    linkPage: integer(), // page / minute / slide, depending on linkType
    deletedAt: timestamp(), // soft delete: the row stays so conversations keep their shape
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index("chat_messages_room_idx").on(t.roomId, t.id)],
);

// ------------------------------------------------------------------ CBT (computer-based tests)

export const examStatusEnum = pgEnum("exam_status", ["draft", "published"]);
export const questionTypes = ["single", "multiple", "truefalse", "essay"] as const;
export type QuestionType = (typeof questionTypes)[number];
export const questionTypeEnum = pgEnum("exam_question_type", questionTypes);
export const attemptStatusEnum = pgEnum("exam_attempt_status", ["in_progress", "submitted"]);

export const exams = pgTable("exams", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  description: text().notNull().default(""),
  createdBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  status: examStatusEnum().notNull().default("draft"),
  durationMinutes: integer(), // null = no time limit (the closing time may still cut the attempt short)
  opensAt: timestamp(),
  closesAt: timestamp(),
  maxAttempts: integer().notNull().default(1),
  shuffleQuestions: boolean().notNull().default(false),
  shuffleOptions: boolean().notNull().default(false),
  showTimer: boolean().notNull().default(true),
  accessToken: text(), // null = no token needed
  showScore: boolean().notNull().default(true), // show the score once grading is complete
  showReview: boolean().notNull().default(false), // show correct answers + feedback once graded
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow().$onUpdate(() => new Date()),
});

export const examQuestions = pgTable(
  "exam_questions",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    examId: bigint({ mode: "number" }).notNull().references(() => exams.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    type: questionTypeEnum().notNull(),
    text: text().notNull(),
    explanation: text().notNull().default(""), // shown in the review
    points: integer().notNull().default(1),
  },
  (t) => [index("exam_questions_exam_idx").on(t.examId, t.position)],
);

export const examOptions = pgTable(
  "exam_options",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    questionId: bigint({ mode: "number" }).notNull().references(() => examQuestions.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    text: text().notNull(),
    isCorrect: boolean().notNull().default(false), // never sent to a student while an attempt is running
  },
  (t) => [index("exam_options_question_idx").on(t.questionId, t.position)],
);

export const examAttempts = pgTable(
  "exam_attempts",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    examId: bigint({ mode: "number" }).notNull().references(() => exams.id, { onDelete: "cascade" }),
    studentId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    attemptNo: integer().notNull(),
    seed: integer().notNull(), // fixes question/option order for this attempt (a refresh must not reshuffle)
    startedAt: timestamp().notNull().defaultNow(),
    deadlineAt: timestamp(), // server-side truth for the timer; null = unlimited
    submittedAt: timestamp(),
    status: attemptStatusEnum().notNull().default("in_progress"),
    autoScore: doublePrecision().notNull().default(0), // choice questions
    essayScore: doublePrecision().notNull().default(0), // graded essays so far
    maxScore: doublePrecision().notNull().default(0), // snapshot at start
    gradedAt: timestamp(), // set once no essay is left ungraded
  },
  (t) => [uniqueIndex("exam_attempts_unique").on(t.examId, t.studentId, t.attemptNo), index("exam_attempts_student_idx").on(t.studentId)],
);

export const examAnswers = pgTable(
  "exam_answers",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    attemptId: bigint({ mode: "number" }).notNull().references(() => examAttempts.id, { onDelete: "cascade" }),
    questionId: bigint({ mode: "number" }).notNull().references(() => examQuestions.id, { onDelete: "cascade" }),
    selected: jsonb().$type<number[]>().notNull().default([]), // chosen option ids
    essayText: text().notNull().default(""),
    flagged: boolean().notNull().default(false), // "review later" mark
    score: doublePrecision(), // null = not graded yet (essays)
    feedback: text().notNull().default(""),
    gradedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    gradedAt: timestamp(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [uniqueIndex("exam_answers_unique").on(t.attemptId, t.questionId)],
);

// ------------------------------------------------------------------ video courses

export const videoStatusEnum = pgEnum("video_status", ["uploading", "ready", "failed"]);
export const videoApprovalEnum = pgEnum("video_approval", ["pending", "approved", "rejected"]);
export const videoJobStatusEnum = pgEnum("video_job_status", ["none", "queued", "processing", "ready", "failed"]);

/** A video in the library. Files: UPLOAD_DIR/videos/<id>.mp4|.webm (+ <id>.part while uploading, <id>.jpg poster). */
export const videos = pgTable("videos", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  description: text().notNull().default(""),
  uploadedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  status: videoStatusEnum().notNull().default("uploading"),
  /** Student uploads wait for a teacher/staff/admin/operator; their own uploads publish immediately. */
  approval: videoApprovalEnum().notNull().default("pending"),
  reviewNote: text(),
  reviewedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp(),
  originalName: text().notNull().default(""),
  declaredBytes: bigint({ mode: "number" }).notNull(),
  mime: text(), // video/mp4 | video/webm, set when processing succeeds
  durationSec: doublePrecision(),
  width: integer(),
  height: integer(),
  hasPoster: boolean().notNull().default(false),
  failureReason: text(),
  createdAt: timestamp().notNull().defaultNow(),
  // transcript (cues live in video_cues)
  transcriptStatus: videoJobStatusEnum().notNull().default("none"),
  transcriptSource: text(), // "auto" (speech API) | "manual" (uploaded .vtt/.srt)
  transcriptError: text(),
  // AI summary + chapters
  summaryStatus: videoJobStatusEnum().notNull().default("none"),
  summaryText: text(),
  chapters: jsonb().$type<{ start: number; title: string }[]>(),
  summaryError: text(),
  summaryAt: timestamp(),
});

export const videoCues = pgTable(
  "video_cues",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    videoId: bigint({ mode: "number" }).notNull().references(() => videos.id, { onDelete: "cascade" }),
    idx: integer().notNull(),
    startMs: integer().notNull(),
    endMs: integer().notNull(),
    text: text().notNull(),
  },
  (t) => [index("video_cues_video_idx").on(t.videoId, t.idx)],
);

/** Where each user stopped watching (resume). */
export const videoProgress = pgTable(
  "video_progress",
  {
    userId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    videoId: bigint({ mode: "number" }).notNull().references(() => videos.id, { onDelete: "cascade" }),
    positionSec: doublePrecision().notNull(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })],
);

export const presentationKindEnum = pgEnum("presentation_kind", ["file", "google", "canva"]);
export const presentationStatusEnum = pgEnum("presentation_status", ["converting", "ready", "failed"]);

/**
 * A slide deck. kind "file": an uploaded PPTX/PPT/ODP converted to PDF (UPLOAD_DIR/presentations/<id>/deck.pdf, cover.jpg).
 * kind "google" | "canva": only a link, shown in a sandboxed iframe (nothing stored).
 */
export const presentations = pgTable("presentations", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  description: text().notNull().default(""),
  kind: presentationKindEnum().notNull(),
  link: text(), // normalized viewer link for google/canva, null for files
  status: presentationStatusEnum().notNull().default("converting"),
  failureReason: text(),
  sizeBytes: bigint({ mode: "number" }).notNull().default(0),
  pageCount: integer(), // slides; null for links and until the conversion has finished
  hasCover: boolean().notNull().default(false),
  uploadedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp().notNull().defaultNow(),
});

/** Last slide each user viewed in each file deck. */
export const presentationProgress = pgTable(
  "presentation_progress",
  {
    userId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    presentationId: bigint({ mode: "number" }).notNull().references(() => presentations.id, { onDelete: "cascade" }),
    page: integer().notNull(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.presentationId] })],
);

/** A WebAuthn passkey (fingerprint/face/screen-lock on the user's own device). Only the public key is stored. */
export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text().notNull().unique("webauthn_credential_id_unique"), // base64url
  publicKey: text().notNull(), // base64url COSE key
  counter: bigint({ mode: "number" }).notNull().default(0),
  transports: jsonb().$type<string[]>(),
  label: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
  lastUsedAt: timestamp(),
});

/** `homeroom_teacher` = SD "guru kelas" (one teacher teaches the class's subjects); `subject_teachers` = SMP/SMA/SMK "guru mata pelajaran" (a wali kelas advises, each subject has its own teacher). */
export const classSystems = ["homeroom_teacher", "subject_teachers"] as const;
export type ClassSystem = (typeof classSystems)[number];
export const classSystemEnum = pgEnum("class_system", classSystems);

/** A class group. Owned by its creator; members are who may check in. The homeroom teacher (guru kelas / wali kelas) also manages its attendance. */
export const classrooms = pgTable("classrooms", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  name: text().notNull(),
  ownerId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  system: classSystemEnum().notNull().default("subject_teachers"),
  grade: text(), // free text: "3", "X", "XII"
  homeroomTeacherId: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp().notNull().defaultNow(),
});

export const subjects = pgTable("subjects", { id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(), name: text().notNull() }, (t) => [uniqueIndex("subjects_name_unique").on(sql`lower(${t.name})`)]);

/** A physical room. `ownerId` = the teacher whose own subject room it is (moving class); null = a shared room (lab, hall). */
export const rooms = pgTable(
  "rooms",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull(),
    ownerId: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("rooms_name_unique").on(sql`lower(${t.name})`)],
);

/** A subject taught in a class. `teacherId` null = the class's homeroom teacher teaches it (only valid in `homeroom_teacher` classes). */
export const classroomSubjects = pgTable(
  "classroom_subjects",
  {
    classroomId: bigint({ mode: "number" }).notNull().references(() => classrooms.id, { onDelete: "cascade" }),
    subjectId: bigint({ mode: "number" }).notNull().references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.classroomId, t.subjectId] })],
);

/** One weekly timetable slot. The teacher is derived (assignment teacher, else the homeroom teacher) so it can never drift. `roomId` null = the class stays put; set = the class goes to that room (moving class). */
export const lessons = pgTable(
  "lessons",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    classroomId: bigint({ mode: "number" }).notNull(),
    subjectId: bigint({ mode: "number" }).notNull(),
    weekday: integer().notNull(), // 1 = Monday .. 7 = Sunday
    startMin: integer().notNull(), // minutes after midnight, school local time
    endMin: integer().notNull(),
    roomId: bigint({ mode: "number" }).references(() => rooms.id, { onDelete: "set null" }),
  },
  (t) => [
    foreignKey({ columns: [t.classroomId, t.subjectId], foreignColumns: [classroomSubjects.classroomId, classroomSubjects.subjectId] }).onDelete("cascade"),
    check("lessons_weekday_ok", sql`${t.weekday} between 1 and 7`),
    check("lessons_time_ok", sql`${t.startMin} >= 0 and ${t.endMin} <= 1440 and ${t.startMin} < ${t.endMin}`),
    index("lessons_classroom_idx").on(t.classroomId),
  ],
);

export const classroomMembers = pgTable(
  "classroom_members",
  {
    classroomId: bigint({ mode: "number" }).notNull().references(() => classrooms.id, { onDelete: "cascade" }),
    userId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.classroomId, t.userId] })],
);

/** One roll call. Open until `closedAt` is set or `closesAt` passes. Times come from the app clock (see CBT note). */
export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    classroomId: bigint({ mode: "number" }).notNull().references(() => classrooms.id, { onDelete: "cascade" }),
    title: text().notNull(),
    openedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp().notNull(),
    closesAt: timestamp(), // automatic close; null = until closed by hand
    closedAt: timestamp(),
    lateAfterMinutes: integer(), // check-ins later than startedAt + this are "late"; null = nobody is late
  },
  (t) => [index("attendance_sessions_classroom_idx").on(t.classroomId)],
);

export const attendanceMethodEnum = pgEnum("attendance_method", ["webauthn", "device"]);

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    sessionId: bigint({ mode: "number" }).notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
    userId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    checkedAt: timestamp().notNull(),
    late: boolean().notNull().default(false),
    method: attendanceMethodEnum().notNull().default("webauthn"), // "device" is reserved for a future fingerprint machine
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    distanceM: integer(), // metres from the school at check-in; null when no school location is configured
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
);

/** Homework for one subject of one class. The teacher is whoever teaches that subject there (see modules/classes). */
export const assignments = pgTable(
  "assignments",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    classroomId: bigint({ mode: "number" }).notNull(),
    subjectId: bigint({ mode: "number" }).notNull(),
    title: text().notNull(),
    instructions: text().notNull().default(""),
    dueAt: timestamp().notNull(),
    allowLate: boolean().notNull().default(true), // false = submitting after dueAt is refused
    maxPoints: integer().notNull().default(100),
    createdBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.classroomId, t.subjectId], foreignColumns: [classroomSubjects.classroomId, classroomSubjects.subjectId] }).onDelete("cascade"),
    index("assignments_classroom_idx").on(t.classroomId),
  ],
);

/** One per student per assignment; resubmitting replaces the answer until the teacher grades it. */
export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    assignmentId: bigint({ mode: "number" }).notNull().references(() => assignments.id, { onDelete: "cascade" }),
    studentId: bigint({ mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
    text: text().notNull().default(""),
    submittedAt: timestamp().notNull(), // app clock, like CBT: the remote DB clock differs by minutes
    late: boolean().notNull().default(false),
    score: doublePrecision(),
    feedback: text(),
    gradedAt: timestamp(),
    gradedBy: bigint({ mode: "number" }).references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("assignment_submissions_unique").on(t.assignmentId, t.studentId)],
);

/** A file on an assignment (the teacher's worksheet) or on a submission (the student's answer). Bytes live at UPLOAD_DIR/assignments/<id>. */
export const assignmentFiles = pgTable(
  "assignment_files",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    assignmentId: bigint({ mode: "number" }).references(() => assignments.id, { onDelete: "cascade" }),
    submissionId: bigint({ mode: "number" }).references(() => assignmentSubmissions.id, { onDelete: "cascade" }),
    name: text().notNull(),
    size: bigint({ mode: "number" }).notNull(),
    createdAt: timestamp().notNull(),
  },
  (t) => [check("assignment_files_one_owner", sql`(${t.assignmentId} is null) <> (${t.submissionId} is null)`), index("assignment_files_assignment_idx").on(t.assignmentId), index("assignment_files_submission_idx").on(t.submissionId)],
);
