import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import * as cbtApi from "../services/cbtApi";
import type { GradingView } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

export function useGrading(attemptId: number) {
  const toast = useToast();
  const view = ref<GradingView | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const savingId = ref<number | null>(null);

  const ungraded = computed(() => view.value?.questions.filter((q) => q.type === "essay" && q.score === null).length ?? 0);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      view.value = await cbtApi.fetchGrading(attemptId);
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  async function grade(questionId: number, score: number, feedback: string): Promise<boolean> {
    savingId.value = questionId;
    try {
      const r = await cbtApi.gradeEssay(attemptId, questionId, score, feedback);
      const v = view.value;
      if (v) {
        // the server recomputes the totals; mirror them so the header updates without a reload
        view.value = {
          ...v,
          essayScore: r.essayScore,
          total: r.total,
          percent: v.max ? Math.round((r.total / v.max) * 10000) / 100 : 0,
          graded: r.graded,
          questions: v.questions.map((q) => (q.id === questionId ? { ...q, score, feedback } : q)),
        };
      }
      toast.success("Nilai disimpan");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      savingId.value = null;
    }
  }

  onMounted(load);

  return { view, loading, error, savingId, ungraded, load, grade };
}
