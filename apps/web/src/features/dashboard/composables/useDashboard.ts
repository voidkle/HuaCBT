import { onMounted, ref } from "vue";
import { getDashboard } from "../services/dashboardApi";
import type { DashboardData } from "../types";

export function useDashboard() {
  const data = ref<DashboardData | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await getDashboard();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Gagal memuat dashboard";
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);

  return { data, loading, error, reload: load };
}
