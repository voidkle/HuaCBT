<script setup lang="ts">
import { computed, ref } from "vue";
import { Captions, Check, Play, Trash2, X } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/features/auth/types";
import { formatDate } from "@/utils/formatDate";
import { formatDuration } from "@/utils/formatDuration";
import { posterUrl } from "../services/videoApi";
import type { VideoSummary } from "../types";

interface Props {
  video: VideoSummary;
  canReview: boolean;
  canDelete: boolean;
  busy: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ approve: [video: VideoSummary]; reject: [video: VideoSummary]; delete: [video: VideoSummary] }>();

const posterFailed = ref(false);
const playable = computed(() => props.video.status === "ready");
const percent = computed(() => (props.video.progressSec && props.video.durationSec ? Math.min(100, Math.round((props.video.progressSec / props.video.durationSec) * 100)) : 0));
const waiting = computed(() => playable.value && props.video.approval === "pending");
</script>

<template>
  <article class="bg-card flex flex-col overflow-hidden rounded-xl border shadow-xs">
    <component :is="playable ? RouterLink : 'div'" :to="playable ? `/videos/${video.id}` : undefined" class="focus-visible:ring-ring/50 block outline-none focus-visible:ring-[3px]" :aria-label="playable ? `Tonton ${video.title}` : undefined">
      <div class="bg-muted relative aspect-video overflow-hidden">
        <img v-if="video.hasPoster && !posterFailed" :src="posterUrl(video.id)" :alt="`Poster ${video.title}`" loading="lazy" class="size-full object-cover" @error="posterFailed = true" />
        <div v-else class="flex size-full items-center justify-center"><Play class="text-muted-foreground size-8" /></div>
        <span v-if="video.durationSec" class="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] text-white tabular-nums">{{ formatDuration(video.durationSec) }}</span>
        <div v-if="percent > 0" class="absolute inset-x-0 bottom-0 h-1 bg-black/20" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100" :aria-label="`Ditonton ${percent}%`"><div class="bg-primary h-full" :style="{ width: `${percent}%` }" /></div>
      </div>
    </component>

    <div class="flex flex-1 flex-col gap-1.5 p-3">
      <h3 class="line-clamp-2 text-[13px] leading-snug font-medium">{{ video.title }}</h3>
      <p class="text-muted-foreground text-xs">
        {{ video.uploader?.name ?? "Pengguna dihapus" }}<template v-if="video.uploader"> · {{ roleLabels[video.uploader.role] }}</template> · {{ formatDate(video.createdAt) }}
      </p>

      <div class="flex flex-wrap items-center gap-1.5">
        <Badge v-if="video.status === 'uploading'" variant="outline">Unggahan belum selesai</Badge>
        <Badge v-else-if="video.status === 'failed'" variant="outline" class="text-destructive border-destructive/40">Gagal diproses</Badge>
        <Badge v-else-if="waiting" variant="outline">Menunggu persetujuan</Badge>
        <Badge v-else-if="video.approval === 'rejected'" variant="outline" class="text-destructive border-destructive/40">Ditolak</Badge>
        <span v-if="video.transcriptStatus === 'ready'" class="text-muted-foreground flex items-center gap-1 text-[11px]" title="Ada transkrip dan teks pendamping"><Captions class="size-3.5" />Teks</span>
      </div>
      <p v-if="video.status === 'failed' && video.failureReason" class="text-destructive text-xs" role="alert">{{ video.failureReason }}</p>
      <p v-if="video.approval === 'rejected' && video.reviewNote" class="bg-muted rounded-md px-2 py-1 text-xs">Catatan: {{ video.reviewNote }}</p>

      <div v-if="(canReview && waiting) || canDelete" class="mt-auto flex flex-wrap items-center gap-1.5 border-t pt-2">
        <template v-if="canReview && waiting">
          <Button size="sm" :disabled="busy" @click="emit('approve', video)"><Check />Setujui</Button>
          <Button size="sm" variant="outline" :disabled="busy" @click="emit('reject', video)"><X />Tolak</Button>
        </template>
        <Button v-if="canDelete" size="icon" variant="ghost" class="text-muted-foreground ml-auto size-7" :aria-label="`Hapus ${video.title}`" :disabled="busy" @click="emit('delete', video)"><Trash2 class="size-3.5" /></Button>
      </div>
    </div>
  </article>
</template>
