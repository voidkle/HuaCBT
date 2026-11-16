import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import * as api from "../services/presenceApi";
import type { Classroom, ClassroomDetail, ClassroomInput } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

export function useClassrooms() {
  const auth = useAuthStore();
  const toast = useToast();
  const items = ref<Classroom[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);
  const selectedId = ref<number | null>(null);

  const canCreate = computed(() => auth.hasRole("admin", "operator", "teacher"));
  const selected = computed(() => items.value.find((c) => c.id === selectedId.value) ?? null);

  async function load(silent = false) {
    if (!silent) loading.value = true;
    try {
      items.value = await api.fetchClassrooms();
      error.value = null;
      if (selectedId.value === null || !items.value.some((c) => c.id === selectedId.value)) selectedId.value = items.value[0]?.id ?? null;
    } catch (e) {
      if (!silent) error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  /** The roster for the edit dialog (the list only has counts). */
  async function detail(id: number): Promise<ClassroomDetail | null> {
    try {
      return await api.fetchClassroom(id);
    } catch (e) {
      toast.error(message(e));
      return null;
    }
  }

  async function save(id: number | null, input: ClassroomInput): Promise<boolean> {
    busy.value = true;
    try {
      const r = id === null ? await api.createClassroom(input) : await api.updateClassroom(id, input);
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

  async function remove(id: number): Promise<boolean> {
    busy.value = true;
    try {
      await api.deleteClassroom(id);
      await load(true);
      toast.success("Kelas dihapus");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  onMounted(() => load());

  return { items, loading, error, busy, selectedId, selected, canCreate, load, detail, save, remove };
}
