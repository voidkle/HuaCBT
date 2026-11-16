import { onMounted, ref } from "vue";
import * as cbtApi from "../services/cbtApi";
import type { AvailableExam } from "../types";

export function useAvailableExams() {
  const exams = ref<AvailableExam[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      exams.value = await cbtApi.fetchAvailable();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Gagal memuat ujian";
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);

  return { exams, loading, error, load };
}
