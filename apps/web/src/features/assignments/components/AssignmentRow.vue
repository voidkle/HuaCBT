<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/utils/formatDate";
import type { Assignment } from "../types";

interface Props {
  item: Assignment;
}
const props = defineProps<Props>();

const overdue = computed(() => props.item.dueAt < new Date());

/** What the badge says: for a student their state, for a teacher how many answers are in. */
const badge = computed(() => {
  const a = props.item;
  if (a.counts) return { text: `${a.counts.submitted}/${a.counts.total} terkumpul · ${a.counts.graded} dinilai`, warn: false };
  const m = a.mine;
  if (!m) return null;
  if (m.status === "graded") return { text: `Dinilai ${m.score}/${a.maxPoints}`, warn: false };
  if (m.status === "submitted") return { text: m.late ? "Dikumpulkan terlambat" : "Dikumpulkan", warn: m.late };
  if (overdue.value) return { text: a.allowLate ? "Belum dikumpulkan · lewat tenggat" : "Ditutup", warn: true };
  return { text: "Belum dikumpulkan", warn: false };
});
</script>

<template>
  <RouterLink :to="`/assignments/${item.id}`" class="bg-card hover:bg-accent focus-visible:ring-ring/50 flex flex-col gap-1 rounded-xl border p-3 shadow-xs outline-none focus-visible:ring-[3px]">
    <span class="flex items-start gap-2">
      <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ item.title }}</span>
      <Badge v-if="badge" variant="outline" :class="badge.warn ? 'text-destructive border-destructive/40' : ''" class="shrink-0 text-[11px]">{{ badge.text }}</Badge>
    </span>
    <span class="text-muted-foreground text-xs">{{ item.subjectName }} · {{ item.classroomName }} · Tenggat {{ formatDateTime(item.dueAt) }}</span>
  </RouterLink>
</template>
