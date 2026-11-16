<script setup lang="ts">
import { computed } from "vue";
import { formatDuration } from "@/utils/formatDuration";
import type { Chapter } from "../types";

interface Props {
  chapters: Chapter[];
  currentTime: number;
}
const props = defineProps<Props>();
const emit = defineEmits<{ seek: [seconds: number] }>();

const activeIndex = computed(() => props.chapters.reduce((found, c, i) => (c.start <= props.currentTime ? i : found), -1));
</script>

<template>
  <ol class="flex flex-col gap-0.5" aria-label="Bab video">
    <li v-for="(c, i) in chapters" :key="c.start">
      <button type="button" class="hover:bg-accent focus-visible:ring-ring/50 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none focus-visible:ring-[3px]" :class="{ 'bg-accent font-medium': i === activeIndex }" :aria-current="i === activeIndex ? 'true' : undefined" @click="emit('seek', c.start)">
        <span class="text-muted-foreground w-11 shrink-0 pt-px text-xs tabular-nums">{{ formatDuration(c.start) }}</span>
        <span class="leading-snug">{{ c.title }}</span>
      </button>
    </li>
  </ol>
</template>
