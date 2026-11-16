<script setup lang="ts">
import { computed } from "vue";
import { DoorOpen, Pencil, Trash2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { toTime, weekdayName } from "../services/timeService";
import type { Lesson } from "../types";

type Row = Lesson & { classroomName?: string };

interface Props {
  lessons: Row[];
  editable?: boolean;
  /** Highlighted as "now". */
  currentId?: number | null;
  /** The weekday (1-7) to mark as today. */
  today?: number | null;
}
const props = withDefaults(defineProps<Props>(), { editable: false, currentId: null, today: null });
const emit = defineEmits<{ edit: [lesson: Lesson]; remove: [lesson: Lesson] }>();

const days = computed(() => {
  const byDay = new Map<number, Row[]>();
  for (const l of props.lessons) byDay.set(l.weekday, [...(byDay.get(l.weekday) ?? []), l]);
  return [...byDay].sort((a, b) => a[0] - b[0]).map(([weekday, rows]) => ({ weekday, rows: rows.sort((a, b) => a.startMin - b.startMin) }));
});
</script>

<template>
  <div v-if="days.length" class="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-3">
    <section v-for="d in days" :key="d.weekday" class="bg-card rounded-xl border p-3 shadow-xs" :aria-label="weekdayName(d.weekday)">
      <h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
        {{ weekdayName(d.weekday) }}
        <Badge v-if="d.weekday === today" variant="secondary" class="text-[11px]">Hari ini</Badge>
      </h3>
      <ul class="flex flex-col gap-1.5">
        <li v-for="l in d.rows" :key="l.id" :class="cn('flex items-start gap-3 rounded-lg px-2 py-1.5', l.id === currentId && 'bg-muted')" :aria-current="l.id === currentId ? 'true' : undefined">
          <span class="text-muted-foreground w-24 shrink-0 pt-0.5 text-xs tabular-nums">{{ toTime(l.startMin) }}–{{ toTime(l.endMin) }}</span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span class="text-sm font-medium break-words">{{ l.subjectName }}<span v-if="l.classroomName" class="text-muted-foreground font-normal"> · {{ l.classroomName }}</span></span>
            <span class="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
              <span>{{ l.teacherName ?? "Guru belum ditentukan" }}</span>
              <span v-if="l.roomName" class="flex items-center gap-1"><DoorOpen class="size-3 shrink-0" aria-hidden="true" />Pindah ke {{ l.roomName }}</span>
              <span v-else>Di kelas</span>
            </span>
          </span>
          <span v-if="editable" class="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="icon" :aria-label="`Ubah ${l.subjectName} ${weekdayName(l.weekday)}`" @click="emit('edit', l)"><Pencil /></Button>
            <Button variant="ghost" size="icon" :aria-label="`Hapus ${l.subjectName} ${weekdayName(l.weekday)}`" @click="emit('remove', l)"><Trash2 /></Button>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
