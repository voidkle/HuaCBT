<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGrading } from "../composables/useGrading";
import { formatScore } from "../services/examLabels";
import { formatDateTime } from "@/utils/formatDate";
import ReviewQuestionCard from "./ReviewQuestionCard.vue";

interface Props {
  attemptId: number;
}
const props = defineProps<Props>();

const { view, loading, error, savingId, ungraded, load, grade } = useGrading(props.attemptId);
</script>

<template>
  <div v-if="loading" class="flex max-w-3xl flex-col gap-3" aria-busy="true"><Skeleton class="h-20 rounded-xl" /><Skeleton class="h-48 rounded-xl" /></div>

  <div v-else-if="error || !view" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
    <p class="text-destructive text-sm">{{ error ?? "Percobaan tidak tersedia." }}</p>
    <Button variant="outline" @click="load">Coba lagi</Button>
  </div>

  <div v-else class="flex max-w-3xl flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <Button as-child variant="ghost" size="icon" aria-label="Kembali ke hasil ujian"><RouterLink :to="`/cbt/exams/${view.exam.id}/results`"><ArrowLeft class="size-4" /></RouterLink></Button>
      <div class="flex min-w-0 flex-1 flex-col leading-tight">
        <h2 class="truncate text-[13px] font-medium">{{ view.student?.name ?? "Siswa" }} · percobaan {{ view.attemptNo }}</h2>
        <p class="text-muted-foreground text-xs">{{ view.exam.title }}<template v-if="view.submittedAt"> · dikumpulkan {{ formatDateTime(view.submittedAt) }}</template></p>
      </div>
      <Badge variant="outline" :class="view.graded ? 'bg-secondary text-secondary-foreground border-transparent' : ''">{{ view.graded ? "Selesai dinilai" : `${ungraded} esai belum dinilai` }}</Badge>
    </div>

    <div class="bg-card grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-4" aria-label="Ringkasan nilai">
      <div><p class="text-muted-foreground text-xs">Pilihan ganda</p><p class="text-lg font-semibold tabular-nums">{{ formatScore(view.autoScore) }}</p></div>
      <div><p class="text-muted-foreground text-xs">Esai</p><p class="text-lg font-semibold tabular-nums">{{ formatScore(view.essayScore) }}</p></div>
      <div><p class="text-muted-foreground text-xs">Total</p><p class="text-lg font-semibold tabular-nums">{{ formatScore(view.total) }} / {{ formatScore(view.max) }}</p></div>
      <div><p class="text-muted-foreground text-xs">Persen</p><p class="text-lg font-semibold tabular-nums">{{ formatScore(view.percent) }}%</p></div>
    </div>

    <ReviewQuestionCard v-for="(q, i) in view.questions" :key="q.id" :question="q" :index="i" grading :saving="savingId === q.id" @grade="(score, feedback) => grade(q.id, score, feedback)" />
  </div>
</template>
