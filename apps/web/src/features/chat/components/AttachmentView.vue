<script setup lang="ts">
import { Download, FileText } from "lucide-vue-next";
import { formatBytes } from "@/utils/formatBytes";
import { mediaUrl } from "../services/chatApi";
import type { Attachment } from "../types";

interface Props {
  attachment: Attachment;
}
defineProps<Props>();
</script>

<template>
  <a v-if="attachment.kind === 'image'" :href="mediaUrl(attachment.url)" target="_blank" rel="noopener" class="block overflow-hidden rounded-lg">
    <img :src="mediaUrl(attachment.url)" :alt="attachment.name" loading="lazy" class="max-h-72 w-auto max-w-full rounded-lg object-cover" />
  </a>

  <video v-else-if="attachment.kind === 'video'" :src="mediaUrl(attachment.url)" controls playsinline preload="metadata" class="max-h-72 w-full rounded-lg bg-black" :aria-label="`Video ${attachment.name}`" />

  <audio v-else-if="attachment.kind === 'audio'" :src="mediaUrl(attachment.url)" controls preload="none" class="w-64 max-w-full" :aria-label="`Audio ${attachment.name}`" />

  <a v-else :href="mediaUrl(attachment.url)" download class="bg-background text-foreground hover:bg-accent flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors">
    <FileText class="text-muted-foreground size-5 shrink-0" />
    <span class="flex min-w-0 flex-col">
      <span class="truncate font-medium">{{ attachment.name }}</span>
      <span class="text-muted-foreground">{{ formatBytes(attachment.size) }}</span>
    </span>
    <Download class="text-muted-foreground ml-auto size-4 shrink-0" />
  </a>
</template>
