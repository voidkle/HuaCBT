<script setup lang="ts">
import { ref } from "vue";
import { BookOpen, ChevronRight, Play, Presentation } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { coverUrlFor } from "../services/chatApi";
import { linkHref, linkPositionLabel, linkTotalLabel, linkTypeLabel } from "../services/linkTarget";
import type { MessageLink } from "../types";

interface Props {
  link: MessageLink;
}
defineProps<Props>();

const coverFailed = ref(false);
</script>

<template>
  <component
    :is="link.available ? RouterLink : 'div'"
    :to="link.available ? linkHref(link) : undefined"
    class="bg-background/70 flex items-center gap-3 rounded-lg border p-2 text-left"
    :class="link.available ? 'hover:bg-background transition-colors' : 'opacity-60'"
    :aria-label="link.available ? `Buka ${link.title}, ${linkPositionLabel(link)}` : undefined"
  >
    <div class="bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md" :class="link.type === 'ebook' ? 'h-[72px] w-14' : 'h-14 w-24'">
      <img v-if="link.available && link.hasCover && !coverFailed" :src="coverUrlFor(link.type, link.ref)" :alt="`${link.type === 'video' ? 'Poster' : link.type === 'slide' ? 'Slide pertama' : 'Sampul'} ${link.title}`" loading="lazy" class="size-full object-cover" @error="coverFailed = true" />
      <Play v-else-if="link.type === 'video'" class="text-muted-foreground size-5" />
      <Presentation v-else-if="link.type === 'slide'" class="text-muted-foreground size-5" />
      <BookOpen v-else class="text-muted-foreground size-5" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-muted-foreground text-[11px]">{{ linkTypeLabel(link.type) }}</span>
      <span class="line-clamp-2 text-[13px] leading-snug font-medium">{{ link.available ? link.title : `${linkTypeLabel(link.type)} tidak tersedia lagi` }}</span>
      <span v-if="link.available" class="text-muted-foreground text-xs">{{ linkPositionLabel(link) }} {{ linkTotalLabel(link) }}</span>
    </div>
    <ChevronRight v-if="link.available" class="text-muted-foreground size-4 shrink-0" />
  </component>
</template>
