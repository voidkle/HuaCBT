import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import * as api from "../services/presentationApi";
import type { Presentation, PresentationInput } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");
const POLL_MS = 3000;

export function usePresentationLibrary() {
  const auth = useAuthStore();
  const toast = useToast();

  const items = ref<Presentation[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);

  const canUpload = computed(() => auth.hasRole("admin", "operator", "teacher", "staff"));
  const canDelete = (p: Presentation) => auth.hasRole("admin", "operator") || (p.uploader !== null && p.uploader.id === auth.user?.id);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await api.fetchPresentations();
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  async function upload(input: PresentationInput): Promise<boolean> {
    busy.value = true;
    try {
      items.value = [await api.createPresentation(input), ...items.value];
      toast.success(input.file ? "Berkas diunggah, sedang dikonversi" : "Presentasi ditambahkan");
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
      await api.deletePresentation(id);
      items.value = items.value.filter((p) => p.id !== id);
      toast.success("Presentasi dihapus");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  // conversions finish on their own: refresh quietly while any deck is still converting
  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    void load();
    timer = setInterval(async () => {
      if (!items.value.some((p) => p.status === "converting")) return;
      try {
        items.value = await api.fetchPresentations();
      } catch {
        /* the next tick retries */
      }
    }, POLL_MS);
  });
  onBeforeUnmount(() => clearInterval(timer));

  return { items, loading, error, busy, canUpload, canDelete, load, upload, remove };
}
