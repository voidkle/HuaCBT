<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check, Loader2, X } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatScore } from "../services/examLabels";
import { questionTypeLabels, type ReviewQuestion } from "../types";

interface Props {
  question: ReviewQuestion;
  index: number;
  /** Grader mode: essays get a score + feedback form. Students only read. */
  grading?: boolean;
  saving?: boolean;
}
const props = withDefaults(defineProps<Props>(), { grading: false, saving: false });
const emit = defineEmits<{ grade: [score: number, feedback: string] }>();

const isEssay = computed(() => props.question.type === "essay");
const score = ref<string>(props.question.score === null ? "" : String(props.question.score));
const feedback = ref(props.question.feedback);
watch(
  () => [props.question.score, props.question.feedback] as const,
  ([s, f]) => {
    score.value = s === null ? "" : String(s);
    feedback.value = f;
  },
);

const valid = computed(() => {
  const n = Number(score.value);
  return score.value !== "" && Number.isFinite(n) && n >= 0 && n <= props.question.points;
});
const unanswered = computed(() => (isEssay.value ? props.question.essayText.trim() === "" : props.question.selected.length === 0));

/** How a choice row should look: the right answer, the student's wrong pick, or neutral. */
const optionState = (o: ReviewQuestion["options"][number]) => {
  const picked = props.question.selected.includes(o.id);
  if (o.correct) return picked ? "right-picked" : "right-missed";
  return picked ? "wrong-picked" : "neutral";
};
const optionClass = {
  "right-picked": "bg-secondary text-secondary-foreground border-transparent",
  "right-missed": "border-dashed border-foreground/40",
  "wrong-picked": "border-destructive/50 text-destructive",
  neutral: "",
} as const;
const optionNote = { "right-picked": "Jawaban siswa, benar", "right-missed": "Jawaban benar", "wrong-picked": "Jawaban siswa, salah", neutral: "" } as const;

function submit() {
  if (valid.value) emit("grade", Number(score.value), feedback.value.trim());
}
</script>

<template>
  <Card class="gap-3">
    <CardContent class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[13px] font-semibold">Soal {{ index + 1 }}</span>
        <span class="text-muted-foreground text-xs">{{ questionTypeLabels[question.type] }} · {{ question.points }} poin</span>
        <Badge v-if="question.score !== null" variant="outline" class="ml-auto">{{ formatScore(question.score) }} / {{ question.points }}</Badge>
        <Badge v-else-if="isEssay" variant="outline" class="text-muted-foreground ml-auto">Belum dinilai</Badge>
      </div>

      <p class="text-[13px] whitespace-pre-wrap">{{ question.text }}</p>

      <ul v-if="!isEssay" class="flex flex-col gap-1.5">
        <li v-for="o in question.options" :key="o.id" class="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]" :class="optionClass[optionState(o)]">
          <Check v-if="o.correct" class="size-3.5 shrink-0" aria-hidden="true" />
          <X v-else-if="optionState(o) === 'wrong-picked'" class="size-3.5 shrink-0" aria-hidden="true" />
          <span v-else class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="flex-1">{{ o.text }}</span>
          <span v-if="optionNote[optionState(o)]" class="text-xs">{{ optionNote[optionState(o)] }}</span>
        </li>
      </ul>
      <p v-if="!isEssay && unanswered" class="text-muted-foreground text-xs">Tidak dijawab.</p>

      <div v-if="isEssay" class="flex flex-col gap-1.5">
        <p class="text-muted-foreground text-xs">Jawaban siswa</p>
        <p v-if="!unanswered" class="bg-muted rounded-lg px-3 py-2 text-[13px] whitespace-pre-wrap">{{ question.essayText }}</p>
        <p v-else class="text-muted-foreground text-xs">Tidak dijawab (otomatis bernilai 0).</p>
      </div>

      <form v-if="grading && isEssay" class="flex flex-col gap-2 border-t pt-3" @submit.prevent="submit">
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1.5">
            <Label :for="`score-${question.id}`">Nilai (0 sampai {{ question.points }})</Label>
            <Input :id="`score-${question.id}`" v-model="score" type="number" inputmode="decimal" min="0" :max="question.points" step="0.5" class="w-28" required />
          </div>
          <Button type="submit" size="sm" :disabled="!valid || saving">
            <Loader2 v-if="saving" class="animate-spin" />
            Simpan nilai
          </Button>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label :for="`fb-${question.id}`">Umpan balik untuk siswa (opsional)</Label>
          <Textarea :id="`fb-${question.id}`" v-model="feedback" rows="2" maxlength="2000" class="md:text-[13px]" />
        </div>
      </form>
      <div v-else-if="isEssay && question.feedback" class="flex flex-col gap-1">
        <p class="text-muted-foreground text-xs">Umpan balik guru</p>
        <p class="text-[13px] whitespace-pre-wrap">{{ question.feedback }}</p>
      </div>

      <div v-if="question.explanation" class="bg-muted flex flex-col gap-0.5 rounded-lg px-3 py-2">
        <p class="text-muted-foreground text-xs">Pembahasan</p>
        <p class="text-[13px] whitespace-pre-wrap">{{ question.explanation }}</p>
      </div>
    </CardContent>
  </Card>
</template>
