import { onMounted, type Ref, ref, watch } from "vue";
import { useToast } from "@/composables/useToast";
import * as api from "../services/assignmentsApi";
import type { AssignmentDetail, AssignmentInput, RosterRow, SubmissionDetail, SubmissionInput } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

/** One assignment: for a student their answer, for the teacher the roster and grading. */
export function useAssignmentDetail(id: Ref<number>) {
  const toast = useToast();
  const detail = ref<AssignmentDetail | null>(null);
  const roster = ref<RosterRow[]>([]);
  const opened = ref<SubmissionDetail | null>(null);
  const maxMb = ref<number | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);
  let latest = 0;

  async function load(silent = false) {
    const mine = ++latest;
    if (!silent) loading.value = true;
    try {
      const d = await api.fetchAssignment(id.value);
      const r = d.canManage ? await api.fetchRoster(id.value) : [];
      if (mine !== latest) return;
      [detail.value, roster.value, error.value] = [d, r, null];
    } catch (e) {
      if (mine === latest && !silent) error.value = message(e);
    } finally {
      if (mine === latest) loading.value = false;
    }
  }

  /** Runs one change, reloads and reports; true when it worked. */
  async function change(action: () => Promise<unknown>, done: string): Promise<boolean> {
    busy.value = true;
    try {
      await action();
      await load(true);
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  const submit = (input: SubmissionInput) => change(() => api.submitAnswer(id.value, input), "Jawaban terkirim");
  const update = (input: AssignmentInput) => change(() => api.updateAssignment(id.value, input), "Tugas diperbarui");
  const remove = () => change(() => api.deleteAssignment(id.value), "Tugas dihapus");
  const attach = (files: File[]) => change(() => api.addFiles(id.value, files), "Lampiran ditambahkan");
  const detach = (fileId: number) => change(() => api.removeFile(id.value, fileId), "Lampiran dihapus");

  async function open(submissionId: number) {
    try {
      opened.value = await api.fetchSubmission(submissionId);
    } catch (e) {
      toast.error(message(e));
    }
  }
  /** Re-reads the open answer after grading so the dialog shows the new state. */
  async function afterGrading(submissionId: number, done: string, action: () => Promise<unknown>): Promise<boolean> {
    if (!(await change(action, done))) return false;
    opened.value = await api.fetchSubmission(submissionId).catch(() => null);
    return true;
  }
  const grade = (submissionId: number, score: number, feedback: string) => afterGrading(submissionId, "Nilai disimpan", () => api.gradeSubmission(submissionId, score, feedback));
  const reopen = (submissionId: number) => afterGrading(submissionId, "Dibuka kembali untuk revisi", () => api.reopenSubmission(submissionId));

  onMounted(() => void api.fetchMaxMb().then((m) => (maxMb.value = m)).catch(() => undefined));
  watch(id, () => void load(), { immediate: true });

  return { detail, roster, opened, maxMb, loading, error, busy, load, submit, update, remove, attach, detach, open, grade, reopen };
}
