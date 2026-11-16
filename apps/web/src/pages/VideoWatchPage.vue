<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import ShareToChatDialog from "@/features/chat/components/ShareToChatDialog.vue";
import type { LinkTarget } from "@/features/chat/types";
import VideoWatchView from "@/features/videos/components/VideoWatchView.vue";

const route = useRoute();
const videoId = computed(() => Number(route.params.id));
// shared links can carry ?t=seconds (the "Linker" deep link)
const startAt = computed(() => {
  const n = Number(route.query.t);
  return Number.isFinite(n) && n >= 0 && route.query.t !== undefined ? Math.floor(n) : null;
});

// the videos feature only reports what to share; the chat feature does the sharing. The page assembles both.
const shareOpen = ref(false);
const shareLink = ref<(LinkTarget & { title: string }) | null>(null);
function share(p: { videoId: number; title: string; seconds: number }) {
  shareLink.value = { type: "video", ref: p.videoId, page: p.seconds, title: p.title };
  shareOpen.value = true;
}
</script>

<template>
  <VideoWatchView :key="videoId" :video-id="videoId" :start-at="startAt" @share="share" />
  <ShareToChatDialog v-model:open="shareOpen" :link="shareLink" />
</template>
