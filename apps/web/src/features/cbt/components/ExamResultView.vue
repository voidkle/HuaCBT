<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ArrowLeft, Hourglass } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/utils/formatDate";
import { fetchResult } from "../services/cbtApi";
import { formatScore } from "../services/examLabels";
import type { ResultView } from "../types";
import ReviewQuestionCard from "./ReviewQuestionCard.vue";

interface Props {
  attemptId: number;
}
const props = defineProps<Props>();

const result = ref<ResultView | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    result.value = await fetchResult(props.attemptId);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Hasil tidak dapat dimuat";
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <div v-if="loading" class="flex max-w-2xl flex-col gap-3" aria-busy="true"><Skeleton class="h-40 rounded-xl" /></div>

  <div v-else-if="error || !result" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
    <p class="text-destructive text-sm">{{ error ?? "Hasil tidak tersedia." }}</p>
    <div class="flex gap-2"><Button variant="outline" @click="load">Coba lagi</Button><Button as-child variant="outline"><RouterLink to="/cbt">Kembali</RouterLink></Button></div>
  </div>

  <div v-else class="flex max-w-2xl flex-col gap-3">
    <div class="flex items-center gap-2">
      <Button as-child variant="ghost" size="icon" aria-label="Kembali ke daftar ujian"><RouterLink to="/cbt"><ArrowLeft class="size-4" /></RouterLink></Button>
      <div class="flex min-w-0 flex-col leading-tight">
        <h2 class="truncate text-[13px] font-medium">{{ result.exam.title }}</h2>
        <p class="text-muted-foreground text-xs">Percobaan {{ result.attemptNo }}<template v-if="result.submittedAt"> · dikumpulkan {{ formatDateTime(result.submittedAt) }}</template></p>
      </div>
    </div>

    <div class="bg-card flex flex-col items-center gap-2 rounded-xl border p-6 text-center">
      <template v-if="result.score">
        <p class="text-muted-foreground text-xs">Nilaimu</p>
        <p class="text-4xl font-semibold tabular-nums">{{ formatScore(result.score.total) }}<span class="text-muted-foreground text-lg font-normal"> / {{ formatScore(result.score.max) }}</span></p>
        <p class="text-sm tabular-nums">{{ formatScore(result.score.percent) }}%</p>
      </template>
      <template v-else-if="!result.graded">
        <Hourglass class="text-muted-foreground size-6" />
        <p class="text-sm font-medium">Ujianmu sudah dikumpulkan</p>
        <p class="text-muted-foreground max-w-sm text-xs">Gurumu masih menilai jawaban esai. Nilai akan muncul di sini setelah selesai dinilai.</p>
      </template>
      <template v-else>
        <p class="text-sm font-medium">Ujianmu sudah dikumpulkan dan dinilai</p>
        <p class="text-muted-foreground max-w-sm text-xs">Gurumu tidak menampilkan nilai untuk ujian ini.</p>
      </template>
    </div>

    <template v-if="result.review">
      <h3 class="pt-2 text-[13px] font-medium">Tinjauan jawaban</h3>
      <ReviewQuestionCard v-for="(q, i) in result.review" :key="q.id" :question="q" :index="i" />
    </template>
  </div>
</template>
