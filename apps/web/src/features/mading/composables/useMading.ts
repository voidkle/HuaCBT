import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import * as madingApi from "../services/madingApi";
import type { Notice, NoticeInput, NoticePermissions } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

export function useMading() {
  const auth = useAuthStore();
  const toast = useToast();

  const notices = ref<Notice[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  /** True while a create/update/review/delete request is in flight. */
  const busy = ref(false);

  const canReview = computed(() => auth.hasRole("admin", "operator", "staff"));
  const isMine = (n: Notice) => n.author.id === auth.user?.id;

  const permissions: NoticePermissions = {
    edit: isMine,
    remove: (n) => isMine(n) || canReview.value,
    approve: (n) => canReview.value && n.status !== "approved",
    reject: (n) => canReview.value && n.status !== "rejected",
  };

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      notices.value = await madingApi.fetchNotices();
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  /** Runs a request; shows a toast either way and returns whether it succeeded. */
  async function run(request: () => Promise<void>, success: string): Promise<boolean> {
    busy.value = true;
    try {
      await request();
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  const replace = (n: Notice) => {
    notices.value = notices.value.map((x) => (x.id === n.id ? n : x));
  };

  const create = (input: NoticeInput) =>
    run(async () => {
      const n = await madingApi.createNotice(input);
      notices.value = [n, ...notices.value];
    }, canReview.value ? "Pengumuman dipublikasikan" : "Pengumuman dikirim, menunggu persetujuan");

  const update = (id: number, input: NoticeInput) =>
    run(async () => replace(await madingApi.updateNotice(id, input)), canReview.value ? "Pengumuman diperbarui" : "Perubahan dikirim, menunggu persetujuan");

  const remove = (id: number) =>
    run(async () => {
      await madingApi.deleteNotice(id);
      notices.value = notices.value.filter((x) => x.id !== id);
    }, "Pengumuman dihapus");

  const approve = (id: number) => run(async () => replace(await madingApi.approveNotice(id)), "Pengumuman disetujui");
  const reject = (id: number, note?: string) => run(async () => replace(await madingApi.rejectNotice(id, note)), "Pengumuman ditolak");

  onMounted(load);

  return { notices, loading, error, busy, canReview, permissions, load, create, update, remove, approve, reject };
}
