<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { AlertCircle, Check, Share2, X } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { roleLabels } from "@/features/auth/types";
import { formatDate } from "@/utils/formatDate";
import { formatDuration } from "@/utils/formatDuration";
import { useVideoWatch } from "../composables/useVideoWatch";
import { captionsUrl, fileUrl, posterUrl } from "../services/videoApi";
import { SPEEDS } from "../types";
import ChapterList from "./ChapterList.vue";
import TranscriptPanel from "./TranscriptPanel.vue";
import VideoManagePanel from "./VideoManagePanel.vue";
import VideoRejectDialog from "./VideoRejectDialog.vue";

interface Props {
  videoId: number;
  /** From a shared link (?t=seconds); overrides the saved position. */
  startAt: number | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{ share: [payload: { videoId: number; title: string; seconds: number }] }>();

const auth = useAuthStore();
const { video, cues, flags, loading, error, busy, currentTime, speed, captionsVersion, hasCues, activeCueIndex, initialTime, reportTime, savePosition, setSpeed, saveMeta, approve, reject, makeTranscript, makeSummary, removeTranscript, addCaptions } = useVideoWatch(props.videoId, props.startAt);

const el = ref<HTMLVideoElement | null>(null);
const tab = ref("transcript");
const rejectOpen = ref(false);

const isReviewer = computed(() => auth.hasRole("admin", "operator", "teacher", "staff"));
const isOwner = computed(() => video.value?.uploader?.id === auth.user?.id);
const canManage = computed(() => isOwner.value || isReviewer.value);
const playable = computed(() => video.value?.status === "ready");
const waiting = computed(() => playable.value && video.value?.approval === "pending");
const chapters = computed(() => video.value?.summary?.chapters ?? []);

let seeded = false;
function onLoadedMetadata() {
  const v = el.value;
  if (!v) return;
  v.playbackRate = speed.value;
  if (!seeded) {
    seeded = true;
    if (initialTime.value > 0) v.currentTime = initialTime.value;
  }
}

function seek(seconds: number) {
  const v = el.value;
  if (!v) return;
  v.currentTime = seconds;
  void v.play().catch(() => undefined); // a browser may refuse autoplay before any interaction: the seek still happened
  v.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

watch(speed, (s) => {
  if (el.value) el.value.playbackRate = s;
});
// captions: reload the track when the transcript changes, and turn it on when it first appears
watch(captionsVersion, async () => {
  await nextTick();
  const track = el.value?.textTracks[0];
  if (track) track.mode = "showing";
});

async function confirmReject(note: string) {
  if (await reject(note)) rejectOpen.value = false;
}
</script>

<template>
  <div v-if="loading" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true"><Skeleton class="aspect-video rounded-xl" /><Skeleton class="h-80 rounded-xl" /></div>

  <div v-else-if="error || !video" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
    <p class="text-destructive text-sm">{{ error ?? "Video tidak tersedia." }}</p>
    <Button as-child variant="outline"><RouterLink to="/videos">Kembali ke daftar video</RouterLink></Button>
  </div>

  <div v-else class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="flex min-w-0 flex-col gap-3">
      <p v-if="waiting" class="bg-muted flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs" role="status">
        <AlertCircle class="size-4 shrink-0" />
        <span class="flex-1">Video ini menunggu persetujuan{{ isReviewer ? "." : " dan belum terlihat oleh siswa lain." }}</span>
        <template v-if="isReviewer && !isOwner">
          <Button size="sm" :disabled="busy" @click="approve"><Check />Setujui</Button>
          <Button size="sm" variant="outline" :disabled="busy" @click="rejectOpen = true"><X />Tolak</Button>
        </template>
      </p>
      <p v-else-if="video.approval === 'rejected'" class="text-destructive bg-muted rounded-lg px-3 py-2 text-xs" role="status">Video ini ditolak{{ video.reviewNote ? `: ${video.reviewNote}` : "." }}</p>

      <div v-if="playable" class="overflow-hidden rounded-xl bg-black">
        <video
          ref="el"
          class="aspect-video w-full"
          :src="fileUrl(video.id)"
          :poster="video.hasPoster ? posterUrl(video.id) : undefined"
          crossorigin="use-credentials"
          controls
          playsinline
          preload="metadata"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="reportTime(($event.target as HTMLVideoElement).currentTime)"
          @pause="savePosition"
          @ended="savePosition"
        >
          <track v-if="hasCues" :key="captionsVersion" kind="subtitles" srclang="id" label="Indonesia" :src="captionsUrl(video.id, captionsVersion)" default />
        </video>
      </div>
      <div v-else class="bg-muted text-muted-foreground flex aspect-video items-center justify-center rounded-xl p-6 text-center text-sm">
        {{ video.status === "failed" ? `Video gagal diproses: ${video.failureReason ?? "berkas tidak valid"}` : "Unggahan video ini belum selesai." }}
      </div>

      <div v-if="playable" class="flex flex-wrap items-center gap-2">
        <Select :model-value="String(speed)" @update:model-value="(v) => setSpeed(Number(v))">
          <SelectTrigger size="sm" class="w-28 text-xs" aria-label="Kecepatan putar"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem v-for="s in SPEEDS" :key="s" :value="String(s)">{{ s === 1 ? "Normal" : `${s}×` }}</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" size="sm" @click="emit('share', { videoId: video.id, title: video.title, seconds: Math.floor(currentTime) })"><Share2 />Bagikan dari menit {{ formatDuration(currentTime) }}</Button>
        <span v-if="hasCues" class="text-muted-foreground text-xs">Teks pendamping aktif (tombol CC di pemutar).</span>
      </div>

      <div class="flex flex-col gap-1">
        <h2 class="text-sm font-semibold">{{ video.title }}</h2>
        <p class="text-muted-foreground text-xs">{{ video.uploader?.name ?? "Pengguna dihapus" }}<template v-if="video.uploader"> · {{ roleLabels[video.uploader.role] }}</template> · {{ formatDate(video.createdAt) }}</p>
        <p v-if="video.description" class="mt-1 text-[13px] whitespace-pre-wrap">{{ video.description }}</p>
      </div>
    </div>

    <aside class="bg-card flex min-h-0 flex-col rounded-xl border p-3 lg:h-[calc(100svh-9rem)]" aria-label="Transkrip dan ringkasan">
      <Tabs v-model="tab" class="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList class="w-full">
          <TabsTrigger value="transcript">Transkrip</TabsTrigger>
          <TabsTrigger value="summary">Ringkasan</TabsTrigger>
          <TabsTrigger v-if="canManage && playable" value="manage">Kelola</TabsTrigger>
        </TabsList>
        <TabsContent value="transcript" class="min-h-80 flex-1 lg:min-h-0">
          <TranscriptPanel :cues="cues" :active-index="activeCueIndex" :status="video.transcriptStatus" :error="video.transcriptError" @seek="seek" />
        </TabsContent>
        <TabsContent value="summary" class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="video.summary" class="flex flex-col gap-4">
            <p class="text-[13px] leading-relaxed whitespace-pre-wrap">{{ video.summary.text }}</p>
            <div v-if="chapters.length" class="flex flex-col gap-1"><h3 class="text-xs font-medium">Bab</h3><ChapterList :chapters="chapters" :current-time="currentTime" @seek="seek" /></div>
            <p class="text-muted-foreground text-[11px]">Dibuat oleh AI dari transkrip; periksa kembali jika penting.</p>
          </div>
          <p v-else-if="video.summaryStatus === 'queued' || video.summaryStatus === 'processing'" class="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs" role="status">Ringkasan sedang dibuat…</p>
          <p v-else-if="video.summaryStatus === 'failed'" class="text-destructive rounded-lg border border-dashed px-3 py-3 text-xs" role="alert">Ringkasan gagal dibuat: {{ video.summaryError }}</p>
          <p v-else class="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">Belum ada ringkasan.</p>
        </TabsContent>
        <TabsContent v-if="canManage && playable" value="manage" class="min-h-0 flex-1 overflow-y-auto">
          <VideoManagePanel :video="video" :flags="flags" :can-ai="isReviewer" :busy="busy" @transcript="makeTranscript" @summary="makeSummary" @clear="removeTranscript" @captions="addCaptions" @save="saveMeta" />
        </TabsContent>
      </Tabs>
    </aside>

    <VideoRejectDialog v-model:open="rejectOpen" :video-title="video.title" :submitting="busy" @confirm="confirmReject" />
  </div>
</template>
