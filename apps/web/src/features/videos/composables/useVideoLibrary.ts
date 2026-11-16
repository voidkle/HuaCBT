import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import * as videoApi from "../services/videoApi";
import type { VideoSummary } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

export function useVideoLibrary() {
  const auth = useAuthStore();
  const toast = useToast();

  const videos = ref<VideoSummary[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);

  /** Teacher, staff, admin and operator approve other people's (student) uploads. */
  const canReview = computed(() => auth.hasRole("admin", "operator", "teacher", "staff"));
  const isMine = (v: VideoSummary) => v.uploader?.id === auth.user?.id;
  const canDelete = (v: VideoSummary) => isMine(v) || auth.hasRole("admin", "operator");

  const pending = computed(() => videos.value.filter((v) => v.status === "ready" && v.approval === "pending"));
  const mine = computed(() => videos.value.filter(isMine));

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      videos.value = await videoApi.fetchVideos();
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  const replace = (id: number, changes: Partial<VideoSummary>) => {
    videos.value = videos.value.map((v) => (v.id === id ? { ...v, ...changes } : v));
  };

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

  const approve = (id: number) => run(async () => (await videoApi.approveVideo(id), replace(id, { approval: "approved", reviewNote: null })), "Video disetujui");
  const reject = (id: number, note: string) => run(async () => (await videoApi.rejectVideo(id, note || undefined), replace(id, { approval: "rejected", reviewNote: note || null })), "Video ditolak");
  const remove = (id: number) =>
    run(async () => {
      await videoApi.deleteVideo(id);
      videos.value = videos.value.filter((v) => v.id !== id);
    }, "Video dihapus");

  /** A finished upload joins the list at once (its own approval state tells whether others can see it yet). */
  const added = (v: VideoSummary) => {
    videos.value = [v, ...videos.value.filter((x) => x.id !== v.id)];
  };

  onMounted(load);

  return { videos, loading, error, busy, canReview, canDelete, isMine, pending, mine, load, approve, reject, remove, added };
}
