import { onMounted, ref } from "vue";
import * as cbtApi from "../services/cbtApi";
import type { AttemptRow } from "../types";

export function useAttemptResults(examId: number) {
  const title = ref("");
  const attempts = ref<AttemptRow[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const data = await cbtApi.fetchAttempts(examId);
      title.value = data.exam.title;
      attempts.value = data.attempts;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Gagal memuat hasil";
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);

  return { title, attempts, loading, error, load };
}
