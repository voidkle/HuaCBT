import { api, API_URL } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { Assignment, AssignmentDetail, AssignmentInput, NewAssignment, RosterRow, SubmissionDetail, SubmissionInput, Target } from "../types";

export const fileUrl = (id: number) => `${API_URL}/assignments/files/${id}`;
export const fetchMaxMb = async () => unwrap<{ maxAssignmentMb: number }>(await api.config.public.get()).maxAssignmentMb;

export const fetchTargets = async () => unwrap<Target[]>(await api.assignments.targets.get());
export const fetchAssignments = async (classroomId?: number) => unwrap<Assignment[]>(await api.assignments.get({ query: { classroomId: classroomId === undefined ? undefined : String(classroomId) } }));
export const fetchAssignment = async (id: number) => unwrap<AssignmentDetail>(await api.assignments({ id }).get());
export const createAssignment = async (input: NewAssignment) => unwrap<{ id: number }>(await api.assignments.post(input));
export const updateAssignment = async (id: number, input: AssignmentInput) => unwrap<{ id: number }>(await api.assignments({ id }).patch(input));
export const deleteAssignment = async (id: number) => unwrap<{ ok: true }>(await api.assignments({ id }).delete());

export const addFiles = async (id: number, files: File[]) => unwrap<{ ok: true }>(await api.assignments({ id }).files.post({ files }));
export const removeFile = async (id: number, fileId: number) => unwrap<{ ok: true }>(await api.assignments({ id }).files({ fileId }).delete());

export const fetchRoster = async (id: number) => unwrap<RosterRow[]>(await api.assignments({ id }).submissions.get());
export const submitAnswer = async (id: number, input: SubmissionInput) =>
  unwrap<{ status: string; late: boolean }>(await api.assignments({ id }).submission.put({ text: input.text, keep: input.keep.join(","), files: input.files.length ? input.files : undefined }));

export const fetchSubmission = async (submissionId: number) => unwrap<SubmissionDetail>(await api.assignments.submissions({ sid: submissionId }).get());
export const gradeSubmission = async (submissionId: number, score: number, feedback: string) => unwrap<{ ok: true }>(await api.assignments.submissions({ sid: submissionId }).grade.put({ score, feedback }));
export const reopenSubmission = async (submissionId: number) => unwrap<{ ok: true }>(await api.assignments.submissions({ sid: submissionId }).grade.delete());
