<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import ShareToChatDialog from "@/features/chat/components/ShareToChatDialog.vue";
import type { LinkTarget } from "@/features/chat/types";
import EbookReaderView from "@/features/ebooks/components/EbookReaderView.vue";

const route = useRoute();
const ebookId = computed(() => Number(route.params.id));
// shared links can carry ?page=N (the "Linker" deep link)
const startPage = computed(() => {
  const n = Number(route.query.page);
  return Number.isInteger(n) && n >= 1 ? n : null;
});

// the reader (ebooks feature) only reports what to share; the chat feature does the sharing. The page assembles both.
const shareOpen = ref(false);
const shareLink = ref<(LinkTarget & { title: string }) | null>(null);
function share(p: { ebookId: number; title: string; page: number }) {
  shareLink.value = { type: "ebook", ref: p.ebookId, page: p.page, title: p.title };
  shareOpen.value = true;
}
</script>

<template>
  <EbookReaderView :key="ebookId" :ebook-id="ebookId" :start-page="startPage" @share="share" />
  <ShareToChatDialog v-model:open="shareOpen" :link="shareLink" />
</template>
