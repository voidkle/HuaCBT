<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type EditorQuestion, MAX_OPTIONS, MIN_OPTIONS, type QuestionType, questionTypeLabels } from "../types";

interface Props {
  question: EditorQuestion;
  index: number;
  total: number;
  disabled: boolean;
  /** Validation message for this question, shown under it. */
  problem: string | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  update: [question: EditorQuestion];
  "change-type": [type: QuestionType];
  remove: [];
  move: [direction: -1 | 1];
  duplicate: [];
}>();

const patch = (changes: Partial<EditorQuestion>) => emit("update", { ...props.question, ...changes });
const setOption = (i: number, changes: Partial<EditorQuestion["options"][number]>) => patch({ options: props.question.options.map((o, j) => (j === i ? { ...o, ...changes } : o)) });
const isChoice = computed(() => props.question.type === "single" || props.question.type === "multiple");
const correctIndex = computed(() => props.question.options.findIndex((o) => o.correct));

// single / true-false: exactly one right answer; multiple: any number
const markSingle = (i: number) => patch({ options: props.question.options.map((o, j) => ({ ...o, correct: j === i })) });
const addOption = () => patch({ options: [...props.question.options, { text: "", correct: false }] });
const removeOption = (i: number) => {
  const left = props.question.options.filter((_, j) => j !== i);
  // never leave a single-answer question without a right answer
  patch({ options: props.question.type === "single" && !left.some((o) => o.correct) ? left.map((o, j) => ({ ...o, correct: j === 0 })) : left });
};
const typeEntries = Object.entries(questionTypeLabels) as [QuestionType, string][];
</script>

<template>
  <Card role="group" :aria-label="`Soal ${index + 1}`" class="gap-3" :class="{ 'border-destructive/50': problem }">
    <CardContent class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[13px] font-semibold">Soal {{ index + 1 }}</span>
        <Select :model-value="question.type" :disabled="disabled" @update:model-value="(v) => emit('change-type', v as QuestionType)">
          <SelectTrigger size="sm" class="w-56 text-xs" :aria-label="`Jenis soal ${index + 1}`"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="[value, label] in typeEntries" :key="value" :value="value">{{ label }}</SelectItem>
          </SelectContent>
        </Select>
        <div class="flex items-center gap-1.5">
          <Label :for="`points-${question.key}`" class="text-muted-foreground text-xs">Poin</Label>
          <Input :id="`points-${question.key}`" type="number" min="1" max="1000" step="1" class="h-8 w-20" :model-value="question.points" :disabled="disabled" @update:model-value="(v) => patch({ points: Number(v) })" />
        </div>
        <div class="ml-auto flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" class="size-7" :disabled="disabled || index === 0" :aria-label="`Naikkan soal ${index + 1}`" @click="emit('move', -1)"><ArrowUp class="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" class="size-7" :disabled="disabled || index === total - 1" :aria-label="`Turunkan soal ${index + 1}`" @click="emit('move', 1)"><ArrowDown class="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" class="size-7" :disabled="disabled" :aria-label="`Gandakan soal ${index + 1}`" @click="emit('duplicate')"><Copy class="size-3.5" /></Button>
          <Button type="button" variant="ghost" size="icon" class="text-destructive size-7" :disabled="disabled" :aria-label="`Hapus soal ${index + 1}`" @click="emit('remove')"><Trash2 class="size-3.5" /></Button>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label :for="`text-${question.key}`" class="sr-only">Isi pertanyaan {{ index + 1 }}</Label>
        <Textarea :id="`text-${question.key}`" :model-value="question.text" :disabled="disabled" rows="3" maxlength="5000" placeholder="Tulis pertanyaan…" class="md:text-[13px]" @update:model-value="(v) => patch({ text: String(v) })" />
      </div>

      <!-- single and true/false: one right answer -->
      <RadioGroup v-if="question.type === 'single' || question.type === 'truefalse'" :model-value="String(correctIndex)" class="flex flex-col gap-2" :aria-label="`Pilihan soal ${index + 1}, pilih jawaban yang benar`" @update:model-value="(v) => markSingle(Number(v))">
        <div v-for="(o, i) in question.options" :key="i" class="flex items-center gap-2">
          <RadioGroupItem :id="`o-${question.key}-${i}`" :value="String(i)" :disabled="disabled" :aria-label="`Tandai pilihan ${i + 1} sebagai jawaban benar`" />
          <Input :model-value="o.text" :disabled="disabled || question.type === 'truefalse'" maxlength="500" :placeholder="`Pilihan ${i + 1}`" :aria-label="`Teks pilihan ${i + 1}`" class="h-8" @update:model-value="(v) => setOption(i, { text: String(v) })" />
          <Button v-if="question.type === 'single' && question.options.length > MIN_OPTIONS" type="button" variant="ghost" size="icon" class="size-7 shrink-0" :disabled="disabled" :aria-label="`Hapus pilihan ${i + 1}`" @click="removeOption(i)"><X class="size-3.5" /></Button>
        </div>
      </RadioGroup>

      <!-- multiple: any number of right answers -->
      <div v-else-if="question.type === 'multiple'" class="flex flex-col gap-2" role="group" :aria-label="`Pilihan soal ${index + 1}, centang semua jawaban yang benar`">
        <div v-for="(o, i) in question.options" :key="i" class="flex items-center gap-2">
          <Checkbox :id="`o-${question.key}-${i}`" :model-value="o.correct" :disabled="disabled" :aria-label="`Tandai pilihan ${i + 1} sebagai jawaban benar`" @update:model-value="(v) => setOption(i, { correct: v === true })" />
          <Input :model-value="o.text" :disabled="disabled" maxlength="500" :placeholder="`Pilihan ${i + 1}`" :aria-label="`Teks pilihan ${i + 1}`" class="h-8" @update:model-value="(v) => setOption(i, { text: String(v) })" />
          <Button v-if="question.options.length > MIN_OPTIONS" type="button" variant="ghost" size="icon" class="size-7 shrink-0" :disabled="disabled" :aria-label="`Hapus pilihan ${i + 1}`" @click="removeOption(i)"><X class="size-3.5" /></Button>
        </div>
      </div>

      <p v-else class="text-muted-foreground bg-muted rounded-lg px-3 py-2 text-xs">Siswa menulis jawaban sendiri. Kamu menilainya secara manual (0 sampai {{ question.points }} poin) setelah ujian dikumpulkan.</p>

      <Button v-if="isChoice && question.options.length < MAX_OPTIONS" type="button" variant="outline" size="sm" class="w-fit" :disabled="disabled" @click="addOption"><Plus />Tambah pilihan</Button>

      <div class="flex flex-col gap-1.5">
        <Label :for="`expl-${question.key}`" class="text-muted-foreground text-xs">Pembahasan (opsional, tampil di review siswa)</Label>
        <Textarea :id="`expl-${question.key}`" :model-value="question.explanation" :disabled="disabled" rows="2" maxlength="2000" class="md:text-[13px]" @update:model-value="(v) => patch({ explanation: String(v) })" />
      </div>

      <p v-if="problem" class="text-destructive text-xs" role="alert">{{ problem }}</p>
    </CardContent>
  </Card>
</template>
