import { computed, ref } from "vue";
import { ApiError } from "@/services/unwrap";
import { fetchVideoFlags } from "../services/videoApi";
import { uploadVideo } from "../services/chunkedUpload";
import { ACCEPTED_TYPES, type VideoDetail } from "../types";

const MB = 1024 * 1024;

export function useVideoUpload() {
  const progress = ref(0);
  const phase = ref<"idle" | "uploading" | "processing">("idle");
  const problem = ref<string | null>(null);
  let controller: AbortController | null = null;

  const busy = computed(() => phase.value !== "idle");

  /** Quick checks before any byte is sent. The server repeats them (and ffprobe checks the real codecs). */
  async function precheck(file: File): Promise<string | null> {
    const okType = (ACCEPTED_TYPES as readonly string[]).includes(file.type) || /\.(mp4|webm)$/i.test(file.name);
    if (!okType) return "Gunakan video berformat MP4 atau WebM.";
    const { maxVideoMb } = await fetchVideoFlags().catch(() => ({ maxVideoMb: Infinity }));
    if (file.size > maxVideoMb * MB) return `Ukuran video maksimal ${maxVideoMb} MB (berkas ini ${(file.size / MB).toFixed(0)} MB).`;
    return null;
  }

  /** Resolves with the finished video, or null if it failed (see `problem`) or was cancelled. */
  async function start(file: File, title: string, description: string): Promise<VideoDetail | null> {
    problem.value = await precheck(file);
    if (problem.value) return null;
    controller = new AbortController();
    progress.value = 0;
    phase.value = "uploading";
    try {
      return await uploadVideo({ file, title: title.trim(), description: description.trim() }, { signal: controller.signal, onProgress: (f) => (progress.value = f), onProcessing: () => (phase.value = "processing") });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) problem.value = e instanceof ApiError || e instanceof Error ? e.message : "Gagal mengunggah video";
      return null;
    } finally {
      phase.value = "idle";
      controller = null;
    }
  }

  const cancel = () => controller?.abort();
  const reset = () => {
    progress.value = 0;
    problem.value = null;
  };

  return { progress, phase, busy, problem, start, cancel, reset, precheck };
}
