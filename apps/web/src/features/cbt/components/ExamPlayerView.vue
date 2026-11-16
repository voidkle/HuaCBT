<script setup lang="ts">
import { ref } from "vue";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Grid3x3, Loader2 } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useExamAttempt } from "../composables/useExamAttempt";
import ExamTimer from "./ExamTimer.vue";
import QuestionNavigator from "./QuestionNavigator.vue";
import QuestionPanel from "./QuestionPanel.vue";

interface Props {
  attemptId: number;
}
const props = defineProps<Props>();

const { view, answers, questions, current, index, loading, error, saveState, submitting, remainingMs, answeredCount, flaggedCount, isAnswered, go, next, prev, select, clearChoice, setEssay, toggleFlag, submit, load } = useExamAttempt(props.attemptId);

const confirmOpen = ref(false);
const navOpen = ref(false);

function jump(i: number) {
  go(i);
  navOpen.value = false;
}
async function confirmSubmit() {
  confirmOpen.value = false;
  await submit(false);
}
</script>

<template>
  <div class="bg-background flex h-svh flex-col">
    <header class="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <h1 class="min-w-0 flex-1 truncate text-[13px] font-medium">{{ view?.exam.title ?? "Ujian" }}</h1>

      <p v-if="saveState === 'error'" class="text-destructive flex items-center gap-1 text-xs" role="alert"><AlertTriangle class="size-3.5" />Gagal menyimpan, mencoba lagi…</p>
      <p v-else-if="saveState === 'saving'" class="text-muted-foreground flex items-center gap-1 text-xs"><Loader2 class="size-3.5 animate-spin" />Menyimpan…</p>
      <p v-else-if="saveState === 'saved'" class="text-muted-foreground flex items-center gap-1 text-xs"><Check class="size-3.5" />Tersimpan</p>

      <ExamTimer v-if="view?.exam.showTimer || (remainingMs !== null && remainingMs <= 300_000)" :remaining-ms="remainingMs" />
      <Button size="sm" :disabled="loading || !view || submitting" @click="confirmOpen = true">
        <Loader2 v-if="submitting" class="animate-spin" />
        Kumpulkan
      </Button>
    </header>

    <div v-if="loading" class="flex flex-1 flex-col gap-3 p-4" aria-busy="true"><Skeleton class="h-6 w-1/3" /><Skeleton class="h-24" /><Skeleton class="h-12" /><Skeleton class="h-12" /></div>

    <div v-else-if="error || !view" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error ?? "Ujian tidak tersedia." }}</p>
      <Button variant="outline" @click="load">Coba lagi</Button>
    </div>

    <template v-else>
      <div class="flex min-h-0 flex-1">
        <main class="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <div class="mx-auto flex max-w-2xl flex-col gap-6">
            <QuestionPanel v-if="current && answers[current.id]" :key="current.id" :question="current" :answer="answers[current.id]!" :index="index" :total="questions.length" @select="(id, on) => select(current!, id, on)" @essay="(t) => setEssay(current!, t)" @flag="toggleFlag(current!)" @clear="clearChoice(current!)" />
          </div>
        </main>

        <aside class="hidden w-64 shrink-0 overflow-y-auto border-l p-4 lg:block">
          <p class="mb-3 text-xs font-medium">Soal ({{ answeredCount }}/{{ questions.length }} terjawab)</p>
          <QuestionNavigator :questions="questions" :answers="answers" :current="index" :is-answered="isAnswered" @go="jump" />
        </aside>
      </div>

      <footer class="flex h-14 shrink-0 items-center gap-2 border-t px-3">
        <Button variant="outline" :disabled="index === 0" @click="prev"><ChevronLeft />Sebelumnya</Button>
        <Sheet v-model:open="navOpen">
          <SheetTrigger as-child>
            <Button variant="ghost" class="lg:hidden" :aria-label="`Daftar soal, ${answeredCount} dari ${questions.length} terjawab`"><Grid3x3 />{{ answeredCount }}/{{ questions.length }}</Button>
          </SheetTrigger>
          <SheetContent side="bottom" class="max-h-[70svh] overflow-y-auto">
            <SheetHeader><SheetTitle>Daftar soal</SheetTitle><SheetDescription>{{ answeredCount }} dari {{ questions.length }} terjawab</SheetDescription></SheetHeader>
            <div class="p-4 pt-0"><QuestionNavigator :questions="questions" :answers="answers" :current="index" :is-answered="isAnswered" @go="jump" /></div>
          </SheetContent>
        </Sheet>
        <Button class="ml-auto" :variant="index === questions.length - 1 ? 'outline' : 'default'" :disabled="index === questions.length - 1" @click="next">Berikutnya<ChevronRight /></Button>
      </footer>
    </template>

    <BaseConfirmDialog
      v-model:open="confirmOpen"
      title="Kumpulkan ujian?"
      :description="`${answeredCount} dari ${questions.length} soal terjawab${questions.length - answeredCount > 0 ? `, ${questions.length - answeredCount} belum dijawab` : ''}${flaggedCount ? `, ${flaggedCount} ditandai` : ''}. Setelah dikumpulkan, jawaban tidak bisa diubah.`"
      confirm-label="Kumpulkan"
      :destructive="false"
      :submitting="submitting"
      @confirm="confirmSubmit"
    />
  </div>
</template>
