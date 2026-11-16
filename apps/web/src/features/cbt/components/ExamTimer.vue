<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Clock } from "lucide-vue-next";

interface Props {
  remainingMs: number | null;
}
const props = defineProps<Props>();

const pad = (n: number) => String(n).padStart(2, "0");
const text = computed(() => {
  const total = Math.ceil((props.remainingMs ?? 0) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(total % 60)}` : `${pad(m)}:${pad(total % 60)}`;
});
const tone = computed(() => ((props.remainingMs ?? Infinity) <= 60_000 ? "text-destructive" : (props.remainingMs ?? Infinity) <= 300_000 ? "text-foreground font-semibold" : "text-muted-foreground"));

// screen readers hear the time only at a few milestones, not every second
const announcement = ref("");
const minutesLeft = computed(() => (props.remainingMs === null ? null : Math.ceil(props.remainingMs / 60_000)));
watch(minutesLeft, (m) => {
  if (m !== null && [10, 5, 1].includes(m)) announcement.value = `Sisa waktu ${m} menit`;
});
</script>

<template>
  <div v-if="remainingMs !== null" class="flex items-center gap-1.5 text-sm tabular-nums" :class="tone" role="timer" aria-label="Sisa waktu" aria-live="off">
    <Clock class="size-4" aria-hidden="true" />
    <span>{{ text }}</span>
  </div>
  <span class="sr-only" aria-live="polite">{{ announcement }}</span>
</template>
