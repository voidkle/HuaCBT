import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import * as api from "../services/classesApi";
import type { ClassInput, ClassSummary } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

export function useClassDirectory() {
  const auth = useAuthStore();
  const toast = useToast();
  const items = ref<ClassSummary[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);
  const selectedId = ref<number | null>(null);

  /** The school office (admin, operator, staff) maintains the structure. */
  const canManage = computed(() => auth.hasRole("admin", "operator", "staff"));
  const selected = computed(() => items.value.find((c) => c.id === selectedId.value) ?? null);

  async function load(silent = false) {
    if (!silent) loading.value = true;
    try {
      items.value = await api.fetchClasses();
      error.value = null;
      if (selectedId.value === null || !items.value.some((c) => c.id === selectedId.value)) selectedId.value = items.value[0]?.id ?? null;
    } catch (e) {
      if (!silent) error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  async function save(id: number | null, input: ClassInput): Promise<boolean> {
    busy.value = true;
    try {
      const r = id === null ? await api.createClass(input) : await api.updateClass(id, input);
      await load(true);
      selectedId.value = r.id;
      toast.success(id === null ? "Kelas dibuat" : "Kelas diperbarui");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  onMounted(() => load());

  return { items, loading, error, busy, selectedId, selected, canManage, load, save };
}
