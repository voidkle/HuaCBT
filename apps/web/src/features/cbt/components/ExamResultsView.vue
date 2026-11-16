<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeft, Download } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/utils/formatDate";
import { useAttemptResults } from "../composables/useAttemptResults";
import { exportUrl } from "../services/cbtApi";
import { formatScore } from "../services/examLabels";

interface Props {
  examId: number;
}
const props = defineProps<Props>();

const { title, attempts, loading, error, load } = useAttemptResults(props.examId);

const onlyPending = ref(false);
const rows = computed(() => (onlyPending.value ? attempts.value.filter((a) => a.status === "submitted" && !a.graded) : attempts.value));
const pendingCount = computed(() => attempts.value.filter((a) => a.status === "submitted" && !a.graded).length);
const submitted = computed(() => attempts.value.filter((a) => a.status === "submitted"));
const average = computed(() => (submitted.value.length ? submitted.value.reduce((sum, a) => sum + a.percent, 0) / submitted.value.length : 0));
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" aria-busy="true"><Skeleton class="h-16 rounded-xl" /><Skeleton class="h-64 rounded-xl" /></div>

  <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
    <p class="text-destructive text-sm">{{ error }}</p>
    <Button variant="outline" @click="load">Coba lagi</Button>
  </div>

  <div v-else class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <Button as-child variant="ghost" size="icon" aria-label="Kembali ke daftar ujian"><RouterLink to="/cbt"><ArrowLeft class="size-4" /></RouterLink></Button>
      <h2 class="min-w-0 flex-1 truncate text-[13px] font-medium">Hasil: {{ title }}</h2>
      <Button v-if="pendingCount" variant="outline" size="sm" :aria-pressed="onlyPending" :class="{ 'bg-accent': onlyPending }" @click="onlyPending = !onlyPending">Perlu dinilai ({{ pendingCount }})</Button>
      <Button as-child size="sm" variant="outline"><a :href="exportUrl(examId)" download><Download />Ekspor CSV</a></Button>
    </div>

    <div class="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <span>{{ submitted.length }} dikumpulkan</span>
      <span>Rata-rata {{ formatScore(Math.round(average * 100) / 100) }}%</span>
      <span v-if="attempts.length > submitted.length">{{ attempts.length - submitted.length }} sedang mengerjakan</span>
    </div>

    <p v-if="rows.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm">{{ onlyPending ? "Semua esai sudah dinilai." : "Belum ada siswa yang mengerjakan." }}</p>

    <div v-else class="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader class="bg-muted">
          <TableRow>
            <TableHead>Siswa</TableHead>
            <TableHead class="hidden sm:table-cell">Dikumpulkan</TableHead>
            <TableHead class="text-right">Nilai</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="w-20"><span class="sr-only">Aksi</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="a in rows" :key="a.id">
            <TableCell class="font-medium">{{ a.name }}<span class="text-muted-foreground text-xs"> · ke-{{ a.attemptNo }}</span></TableCell>
            <TableCell class="text-muted-foreground hidden text-xs sm:table-cell">{{ a.submittedAt ? formatDateTime(a.submittedAt) : "–" }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ a.status === "submitted" ? `${formatScore(a.total)} / ${formatScore(a.maxScore)} (${formatScore(a.percent)}%)` : "–" }}</TableCell>
            <TableCell>
              <Badge v-if="a.status === 'in_progress'" variant="outline" class="text-muted-foreground">Mengerjakan</Badge>
              <Badge v-else-if="a.graded" variant="outline" class="bg-secondary text-secondary-foreground border-transparent">Selesai</Badge>
              <Badge v-else variant="outline">Perlu dinilai ({{ a.ungraded }})</Badge>
            </TableCell>
            <TableCell class="text-right">
              <Button v-if="a.status === 'submitted'" as-child size="sm" :variant="a.graded ? 'ghost' : 'default'"><RouterLink :to="`/cbt/attempts/${a.id}/grade`">{{ a.graded ? "Lihat" : "Nilai" }}</RouterLink></Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
