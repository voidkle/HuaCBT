import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { useToast } from "@/composables/useToast";
import * as videoApi from "../services/videoApi";
import { type Cue, SPEEDS, type VideoDetail, type VideoFeatureFlags } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");
const SPEED_KEY = "hua-video-speed";
const POLL_MS = 3000;
const SAVE_EVERY_MS = 10_000;

const readSpeed = (): number => {
  try {
    const n = Number(localStorage.getItem(SPEED_KEY));
    return (SPEEDS as readonly number[]).includes(n) ? n : 1;
  } catch {
    return 1;
  }
};

/**
 * One video on the watch page: details, transcript, playback position (resume + deep link) and the transcript/summary
 * jobs (polled while they run). The <video> element itself is owned by the component; it reports time/events here.
 */
export function useVideoWatch(videoId: number, startAt: number | null) {
  const toast = useToast();

  const video = ref<VideoDetail | null>(null);
  const cues = shallowRef<Cue[]>([]);
  const flags = ref<VideoFeatureFlags | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);

  const currentTime = ref(0);
  const speed = ref(readSpeed());
  /** Bumped whenever the transcript changes, so the <track> reloads its captions. */
  const captionsVersion = ref(0);

  const hasCues = computed(() => cues.value.length > 0);
  const activeCueIndex = computed(() => {
    const ms = currentTime.value * 1000;
    const list = cues.value;
    // binary search: the last cue that started at or before now, if it has not ended yet
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]!.startMs <= ms) (found = mid), (lo = mid + 1);
      else hi = mid - 1;
    }
    return found !== -1 && ms <= list[found]!.endMs + 1500 ? found : -1;
  });
  const running = computed(() => ["queued", "processing"].includes(video.value?.transcriptStatus ?? "") || ["queued", "processing"].includes(video.value?.summaryStatus ?? ""));

  // the position to start from: a shared link wins over the saved one
  const initialTime = computed(() => {
    const v = video.value;
    if (!v) return 0;
    if (startAt !== null) return startAt;
    const t = v.progressSec ?? 0;
    return v.durationSec && t >= v.durationSec - 2 ? 0 : t; // saved position was the end: start over
  });

  async function loadCues() {
    try {
      cues.value = await videoApi.fetchCues(videoId);
    } catch {
      cues.value = [];
    }
    captionsVersion.value++;
  }

  async function reload(withCues = true) {
    video.value = await videoApi.fetchVideo(videoId);
    if (withCues) await loadCues();
  }

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      flags.value = await videoApi.fetchVideoFlags().catch(() => null);
      await reload();
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  // ---- background jobs: poll until they settle, then refresh the transcript
  let poll: ReturnType<typeof setInterval> | undefined;
  function ensurePolling() {
    if (poll || !running.value) return;
    poll = setInterval(async () => {
      const before = video.value?.transcriptStatus;
      try {
        await reload(false);
      } catch {
        return;
      }
      if (before !== video.value?.transcriptStatus || video.value?.transcriptStatus === "ready") await loadCues();
      if (!running.value) {
        clearInterval(poll);
        poll = undefined;
      }
    }, POLL_MS);
  }

  async function act(request: () => Promise<unknown>, success: string, after: "cues" | "details" = "details") {
    busy.value = true;
    try {
      await request();
      await reload(after === "cues");
      if (success) toast.success(success);
      ensurePolling();
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  const saveMeta = (title: string, description: string) => act(() => videoApi.updateVideo(videoId, { title, description }), "Perubahan disimpan");
  const approve = () => act(() => videoApi.approveVideo(videoId), "Video disetujui");
  const reject = (note: string) => act(() => videoApi.rejectVideo(videoId, note || undefined), "Video ditolak");
  const makeTranscript = () => act(() => videoApi.startTranscript(videoId), "Transkrip sedang dibuat");
  const makeSummary = () => act(() => videoApi.startSummary(videoId), "Ringkasan sedang dibuat");
  const removeTranscript = () => act(() => videoApi.clearTranscript(videoId), "Transkrip dihapus", "cues");
  async function addCaptions(file: File) {
    if (file.size > 3_000_000) return void toast.error("Berkas teks terlalu besar (maksimal 3 MB)");
    const content = await file.text();
    return act(async () => {
      const r = await videoApi.uploadCaptions(videoId, content);
      toast.success(`${r.cues} baris teks ditambahkan`);
    }, "", "cues");
  }

  // ---- playback position: saved every 10 s while playing, and when leaving
  let lastSaved = -1;
  let lastSaveAt = 0;
  function reportTime(t: number) {
    currentTime.value = t;
    if (Date.now() - lastSaveAt >= SAVE_EVERY_MS) void savePosition();
  }
  async function savePosition() {
    const t = Math.floor(currentTime.value);
    if (!video.value || t === lastSaved || t < 1) return;
    lastSaved = t;
    lastSaveAt = Date.now();
    try {
      await videoApi.saveProgress(videoId, t);
    } catch {
      lastSaved = -1; // retry on the next tick
    }
  }
  function setSpeed(next: number) {
    speed.value = next;
    try {
      localStorage.setItem(SPEED_KEY, String(next));
    } catch {
      /* preference just is not remembered */
    }
  }

  const onHidden = () => document.visibilityState === "hidden" && void savePosition();

  onMounted(async () => {
    await load();
    ensurePolling();
    document.addEventListener("visibilitychange", onHidden);
  });
  onBeforeUnmount(() => {
    clearInterval(poll);
    document.removeEventListener("visibilitychange", onHidden);
    void savePosition();
  });

  return { video, cues, flags, loading, error, busy, currentTime, speed, captionsVersion, hasCues, activeCueIndex, running, initialTime, load, reportTime, savePosition, setSpeed, saveMeta, approve, reject, makeTranscript, makeSummary, removeTranscript, addCaptions };
}
