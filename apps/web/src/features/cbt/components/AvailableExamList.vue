<script setup lang="ts">
import { ref } from "vue";
import { Clock, KeyRound } from "lucide-vue-next";
import { RouterLink, useRouter } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAvailableExams } from "../composables/useAvailableExams";
import { durationLabel, windowLabel } from "../services/examLabels";
import type { AvailableExam } from "../types";
import StartExamDialog from "./StartExamDialog.vue";

const router = useRouter();
const { exams, loading, error, load } = useAvailableExams();

const starting = ref<AvailableExam | null>(null);
const dialogOpen = ref(false);

function begin(e: AvailableExam) {
  if (e.inProgressAttemptId) return void router.push(`/cbt/attempts/${e.inProgressAttemptId}`); // resume: no token, no dialog
  starting.value = e;
  dialogOpen.value = true;
}

const statusText = (e: AvailableExam) =>
  e.window === "upcoming" ? "Belum dibuka" : e.window === "closed" ? "Ditutup" : e.inProgressAttemptId ? "Sedang dikerjakan" : e.attemptsUsed >= e.maxAttempts ? "Kesempatan habis" : "Dibuka";
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-muted-foreground text-xs">Ujian yang tersedia untukmu. Jawaban tersimpan otomatis dan waktu dihitung oleh server.</p>

    <div v-if="loading" class="flex flex-col gap-3" aria-busy="true"><Skeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" /></div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" @click="load">Coba lagi</Button>
    </div>

    <p v-else-if="exams.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">Belum ada ujian untukmu saat ini.</p>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="e in exams" :key="e.id">
        <Card class="gap-2 py-3">
          <CardContent class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="min-w-0 truncate text-[13px] font-medium">{{ e.title }}</h3>
              <Badge variant="outline" :class="e.canStart ? 'bg-secondary text-secondary-foreground border-transparent' : 'text-muted-foreground'">{{ statusText(e) }}</Badge>
              <span v-if="e.requiresToken" class="text-muted-foreground flex items-center gap-1 text-xs"><KeyRound class="size-3" />Perlu token</span>
            </div>
            <p v-if="e.description" class="text-muted-foreground line-clamp-2 text-xs">{{ e.description }}</p>
            <p class="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span class="flex items-center gap-1"><Clock class="size-3" />{{ durationLabel(e.durationMinutes) }}</span>
              <span>{{ e.questionCount }} soal · {{ e.totalPoints }} poin</span>
              <span>{{ e.attemptsUsed }}/{{ e.maxAttempts }} kesempatan</span>
            </p>
            <p class="text-muted-foreground text-xs">{{ windowLabel(e.opensAt, e.closesAt) }}</p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <Button v-if="e.canStart" size="sm" @click="begin(e)">{{ e.inProgressAttemptId ? "Lanjutkan" : "Mulai" }}</Button>
              <Button v-if="e.lastAttemptId" as-child size="sm" variant="outline"><RouterLink :to="`/cbt/attempts/${e.lastAttemptId}/result`">Lihat hasil</RouterLink></Button>
            </div>
          </CardContent>
        </Card>
      </li>
    </ul>

    <StartExamDialog v-model:open="dialogOpen" :exam="starting" />
  </div>
</template>
