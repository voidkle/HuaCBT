import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import * as ebookApi from "../services/ebookApi";
import type { Ebook, EbookUploadInput } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

export function useEbookLibrary() {
  const auth = useAuthStore();
  const toast = useToast();

  const ebooks = ref<Ebook[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);

  const canUpload = computed(() => auth.hasRole("admin", "operator", "teacher", "staff"));
  /** Uploaders delete their own books; admin and operator delete any. */
  const canDelete = (b: Ebook) => auth.hasRole("admin", "operator") || (b.uploader !== null && b.uploader.id === auth.user?.id);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      ebooks.value = await ebookApi.fetchEbooks();
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  async function upload(input: EbookUploadInput): Promise<boolean> {
    busy.value = true;
    try {
      ebooks.value = [await ebookApi.uploadEbook(input), ...ebooks.value];
      toast.success("E-book ditambahkan");
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
      await ebookApi.deleteEbook(id);
      ebooks.value = ebooks.value.filter((b) => b.id !== id);
      toast.success("E-book dihapus");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);

  return { ebooks, loading, error, busy, canUpload, canDelete, load, upload, remove };
}
