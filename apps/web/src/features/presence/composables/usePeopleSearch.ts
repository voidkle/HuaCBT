import { onBeforeUnmount, ref, watch } from "vue";
import * as api from "../services/presenceApi";
import type { Person } from "../types";

/** Debounced student/teacher lookup for the class roster picker. */
export function usePeopleSearch() {
  const query = ref("");
  const results = ref<Person[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = 0;

  async function run() {
    const mine = ++latest;
    loading.value = true;
    try {
      const found = await api.fetchPeople(query.value.trim());
      if (mine === latest) (results.value = found), (error.value = null);
    } catch (e) {
      if (mine === latest) error.value = e instanceof Error ? e.message : "Terjadi kesalahan";
    } finally {
      if (mine === latest) loading.value = false;
    }
  }

  watch(query, () => {
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  onBeforeUnmount(() => clearTimeout(timer));

  return { query, results, loading, error, run };
}
