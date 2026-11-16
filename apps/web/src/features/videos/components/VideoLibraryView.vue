<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVideoLibrary } from "../composables/useVideoLibrary";
import type { VideoDetail, VideoSummary } from "../types";
import VideoCard from "./VideoCard.vue";
import VideoRejectDialog from "./VideoRejectDialog.vue";
import VideoUploadDialog from "./VideoUploadDialog.vue";

const { videos, loading, error, busy, canReview, canDelete, pending, mine, load, approve, reject, remove, added } = useVideoLibrary();

const tab = ref<"all" | "pending" | "mine">("all");
const uploadOpen = ref(false);
const rejecting = ref<VideoSummary | null>(null);
const deleting = ref<VideoSummary | null>(null);

const shown = computed(() => (tab.value === "pending" ? pending.value : tab.value === "mine" ? mine.value : videos.value));

async function onUploaded(v: VideoDetail) {
  added(v);
}
async function confirmReject(note: string) {
  if (rejecting.value && (await reject(rejecting.value.id, note))) rejecting.value = null;
}
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p class="text-muted-foreground text-xs">Video pembelajaran dengan teks pendamping dan transkrip. {{ canReview ? "Video dari siswa perlu kamu setujui sebelum tampil." : "Video yang kamu unggah tampil setelah disetujui guru atau staf." }}</p>
      <Button class="shrink-0 self-start sm:ml-auto sm:self-auto" @click="uploadOpen = true"><Plus />Unggah video</Button>
    </div>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="all">Semua</TabsTrigger>
        <TabsTrigger v-if="canReview" value="pending" class="gap-1.5">Menunggu persetujuan <span class="bg-muted rounded-full px-1.5 text-[11px]">{{ pending.length }}</span></TabsTrigger>
        <TabsTrigger value="mine">Video saya</TabsTrigger>
      </TabsList>
    </Tabs>

    <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true"><Skeleton v-for="i in 4" :key="i" class="aspect-[4/3] rounded-xl" /></div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" @click="load">Coba lagi</Button>
    </div>

    <p v-else-if="shown.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
      {{ tab === "pending" ? "Tidak ada video yang menunggu persetujuan." : tab === "mine" ? "Kamu belum mengunggah video." : "Belum ada video. Unggah yang pertama dengan tombol di atas." }}
    </p>

    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <VideoCard v-for="v in shown" :key="v.id" :video="v" :can-review="canReview" :can-delete="canDelete(v)" :busy="busy" @approve="approve($event.id)" @reject="rejecting = $event" @delete="deleting = $event" />
    </div>

    <VideoUploadDialog v-model:open="uploadOpen" :needs-approval="!canReview" @uploaded="onUploaded" />
    <VideoRejectDialog :open="rejecting !== null" :video-title="rejecting?.title ?? ''" :submitting="busy" @update:open="(v: boolean) => !v && (rejecting = null)" @confirm="confirmReject" />
    <BaseConfirmDialog
      :open="deleting !== null"
      title="Hapus video?"
      :description="`&quot;${deleting?.title ?? ''}&quot; beserta transkrip dan ringkasannya akan dihapus permanen.`"
      :submitting="busy"
      @update:open="(v: boolean) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>
