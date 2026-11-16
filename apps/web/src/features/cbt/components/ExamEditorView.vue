<script setup lang="ts">
import { ref } from "vue";
import { ArrowLeft, BarChart3, FileSpreadsheet, Loader2, Lock, Plus } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useExamEditor } from "../composables/useExamEditor";
import ExamSettingsForm from "./ExamSettingsForm.vue";
import ImportQuestionsDialog from "./ImportQuestionsDialog.vue";
import QuestionEditorCard from "./QuestionEditorCard.vue";

interface Props {
  examId: number;
}
const props = defineProps<Props>();

const { exam, settings, questions, loading, error, saving, locked, published, dirty, questionProblems, settingsProblem, problemCount, totalPoints, load, save, togglePublished, addQuestion, appendImported, removeQuestion, updateQuestion, changeType, move, duplicate } = useExamEditor(props.examId);
const importOpen = ref(false);
</script>

<template>
  <div v-if="loading" class="flex max-w-3xl flex-col gap-3" aria-busy="true"><Skeleton class="h-72 rounded-xl" /><Skeleton class="h-48 rounded-xl" /></div>

  <div v-else-if="error || !exam || !settings" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
    <p class="text-destructive text-sm">{{ error ?? "Ujian tidak tersedia." }}</p>
    <div class="flex gap-2">
      <Button variant="outline" @click="load">Coba lagi</Button>
      <Button as-child variant="outline"><RouterLink to="/cbt">Kembali</RouterLink></Button>
    </div>
  </div>

  <form v-else class="flex max-w-3xl flex-col gap-3 pb-2" @submit.prevent="save">
    <div class="flex flex-wrap items-center gap-2">
      <Button as-child variant="ghost" size="icon" aria-label="Kembali ke daftar ujian"><RouterLink to="/cbt"><ArrowLeft class="size-4" /></RouterLink></Button>
      <h2 class="min-w-0 flex-1 truncate text-[13px] font-medium">{{ settings.title || "Ujian tanpa judul" }}</h2>
      <Badge variant="outline" :class="published ? 'bg-secondary text-secondary-foreground border-transparent' : ''">{{ published ? "Terbit" : "Draf" }}</Badge>
      <Button v-if="locked" as-child variant="outline" size="sm"><RouterLink :to="`/cbt/exams/${exam.id}/results`"><BarChart3 />Hasil</RouterLink></Button>
      <Button type="button" :variant="published ? 'outline' : 'default'" size="sm" :disabled="saving" @click="togglePublished">{{ published ? "Tarik kembali" : "Terbitkan" }}</Button>
    </div>

    <p v-if="locked" class="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2 text-xs" role="status">
      <Lock class="mt-0.5 size-3.5 shrink-0" />
      Pertanyaan terkunci karena sudah ada siswa yang mulai mengerjakan. Pengaturan masih bisa diubah.
    </p>

    <ExamSettingsForm :settings="settings" :problem="settingsProblem" @update="settings = $event" />

    <div class="flex items-center gap-2 pt-2">
      <h3 class="text-[13px] font-medium">Pertanyaan</h3>
      <span class="text-muted-foreground text-xs">{{ questions.length }} soal · {{ totalPoints }} poin</span>
    </div>

    <p v-if="questions.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-10 text-center text-sm">Belum ada pertanyaan. Tambahkan yang pertama.</p>
    <QuestionEditorCard
      v-for="(q, i) in questions"
      :key="q.key"
      :question="q"
      :index="i"
      :total="questions.length"
      :disabled="locked"
      :problem="questionProblems[i] ?? null"
      @update="updateQuestion"
      @change-type="changeType(q.key, $event)"
      @remove="removeQuestion(q.key)"
      @move="move(q.key, $event)"
      @duplicate="duplicate(q.key)"
    />
    <div v-if="!locked" class="flex flex-wrap gap-2">
      <Button type="button" variant="outline" class="w-fit" @click="addQuestion"><Plus />Tambah pertanyaan</Button>
      <Button type="button" variant="outline" class="w-fit" @click="importOpen = true"><FileSpreadsheet />Impor dari Excel</Button>
    </div>

    <div class="bg-background/90 sticky bottom-0 -mx-1 flex items-center justify-end gap-2 border-t px-1 py-3 backdrop-blur">
      <span v-if="problemCount > 0" class="text-destructive mr-auto text-xs" role="alert">{{ problemCount }} bagian perlu diperbaiki</span>
      <span v-else-if="dirty" class="text-muted-foreground mr-auto text-xs">Ada perubahan yang belum disimpan.</span>
      <Button type="submit" :disabled="!dirty || saving || problemCount > 0">
        <Loader2 v-if="saving" class="animate-spin" />
        Simpan
      </Button>
    </div>
  </form>
  <ImportQuestionsDialog v-model:open="importOpen" :existing="questions.length" @import="appendImported" />
</template>
