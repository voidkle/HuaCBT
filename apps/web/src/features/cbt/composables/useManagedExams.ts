import { onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import * as cbtApi from "../services/cbtApi";
import type { ExamSettings, ManagedExam } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

const DEFAULTS: ExamSettings = {
  title: "Ujian baru",
  description: "",
  durationMinutes: 60,
  opensAt: null,
  closesAt: null,
  maxAttempts: 1,
  shuffleQuestions: false,
  shuffleOptions: false,
  showTimer: true,
  accessToken: null,
  showScore: true,
  showReview: false,
};

export function useManagedExams() {
  const toast = useToast();
  const exams = ref<ManagedExam[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      exams.value = await cbtApi.fetchManaged();
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  /** Creates an empty draft and returns its id so the caller can open the editor. */
  async function create(): Promise<number | null> {
    busy.value = true;
    try {
      return (await cbtApi.createExam(DEFAULTS)).id;
    } catch (e) {
      toast.error(message(e));
      return null;
    } finally {
      busy.value = false;
    }
  }

  async function remove(id: number): Promise<boolean> {
    busy.value = true;
    try {
      await cbtApi.deleteExam(id);
      exams.value = exams.value.filter((e) => e.id !== id);
      toast.success("Ujian dihapus");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);

  return { exams, loading, error, busy, load, create, remove };
}
