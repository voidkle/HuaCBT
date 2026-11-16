<script setup lang="ts">
import { Flag } from "lucide-vue-next";
import type { Answer, PlayQuestion } from "../types";

interface Props {
  questions: PlayQuestion[];
  answers: Record<number, Answer>;
  current: number;
  isAnswered: (q: PlayQuestion) => boolean;
}
defineProps<Props>();
const emit = defineEmits<{ go: [index: number] }>();

const label = (q: PlayQuestion, i: number, answers: Record<number, Answer>, answered: boolean) =>
  `Soal ${i + 1}, ${answered ? "terjawab" : "belum dijawab"}${answers[q.id]?.flagged ? ", ditandai" : ""}`;
</script>

<template>
  <nav aria-label="Navigasi soal">
    <ol class="grid grid-cols-5 gap-1.5 sm:grid-cols-6 lg:grid-cols-5">
      <li v-for="(q, i) in questions" :key="q.id">
        <button
          type="button"
          class="relative flex h-9 w-full items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors"
          :class="[isAnswered(q) ? 'bg-primary text-primary-foreground border-transparent' : 'bg-muted', i === current && 'ring-ring ring-2 ring-offset-1']"
          :aria-label="label(q, i, answers, isAnswered(q))"
          :aria-current="i === current ? 'step' : undefined"
          @click="emit('go', i)"
        >
          {{ i + 1 }}
          <Flag v-if="answers[q.id]?.flagged" class="absolute -top-1 -right-1 size-3 fill-current" aria-hidden="true" />
        </button>
      </li>
    </ol>
    <ul class="text-muted-foreground mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" aria-hidden="true">
      <li class="flex items-center gap-1"><span class="bg-primary size-2.5 rounded-sm" />Terjawab</li>
      <li class="flex items-center gap-1"><span class="bg-muted size-2.5 rounded-sm border" />Belum</li>
      <li class="flex items-center gap-1"><Flag class="size-2.5 fill-current" />Ditandai</li>
    </ul>
  </nav>
</template>
