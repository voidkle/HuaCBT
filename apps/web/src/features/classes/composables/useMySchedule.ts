import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import * as api from "../services/classesApi";
import { minutesOf, weekdayOf } from "../services/timeService";
import type { ScheduleLesson } from "../types";

/** The signed-in teacher's or student's week, plus "now" and "next" for today (browser clock). */
export function useMySchedule() {
  const lessons = ref<ScheduleLesson[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const now = ref(new Date());
  let timer: ReturnType<typeof setInterval> | undefined;

  async function load() {
    try {
      lessons.value = await api.fetchMySchedule();
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Terjadi kesalahan";
    } finally {
      loading.value = false;
    }
  }

  const today = computed(() => lessons.value.filter((l) => l.weekday === weekdayOf(now.value)));
  const current = computed(() => today.value.find((l) => l.startMin <= minutesOf(now.value) && minutesOf(now.value) < l.endMin) ?? null);
  const next = computed(() => today.value.find((l) => l.startMin > minutesOf(now.value)) ?? null);

  onMounted(() => {
    void load();
    timer = setInterval(() => (now.value = new Date()), 30_000);
  });
  onBeforeUnmount(() => clearInterval(timer));

  return { lessons, loading, error, load, today, current, next };
}
