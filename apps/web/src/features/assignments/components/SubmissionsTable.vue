<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/utils/formatDate";
import type { RosterRow } from "../types";

interface Props {
  rows: RosterRow[];
  maxPoints: number;
}
defineProps<Props>();
const emit = defineEmits<{ open: [row: RosterRow] }>();

const label = { missing: "Belum", submitted: "Terkumpul", graded: "Dinilai" } as const;
</script>

<template>
  <p v-if="rows.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">Belum ada siswa di kelas ini.</p>
  <ul v-else class="bg-card divide-y rounded-xl border shadow-xs">
    <li v-for="r in rows" :key="r.id" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium">{{ r.name }}</span>
        <span class="text-muted-foreground block truncate text-xs">
          @{{ r.username }}<template v-if="r.submittedAt"> · {{ formatDateTime(r.submittedAt) }}</template>
        </span>
      </span>
      <Badge v-if="r.late && r.status !== 'missing'" variant="outline" class="text-destructive border-destructive/40 text-[11px]">Terlambat</Badge>
      <Badge :variant="r.status === 'graded' ? 'secondary' : 'outline'" class="text-[11px]">{{ label[r.status] }}</Badge>
      <span class="w-16 text-right text-sm tabular-nums">{{ r.score !== null ? `${r.score}/${maxPoints}` : "" }}</span>
      <Button variant="outline" size="sm" :disabled="r.submissionId === null" @click="emit('open', r)">{{ r.status === "graded" ? "Lihat" : "Periksa" }}</Button>
    </li>
  </ul>
</template>
