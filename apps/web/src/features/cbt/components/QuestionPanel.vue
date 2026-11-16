<script setup lang="ts">
import { Flag, RotateCcw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { type Answer, ESSAY_MAX, type PlayQuestion, questionTypeLabels } from "../types";

interface Props {
  question: PlayQuestion;
  answer: Answer;
  index: number;
  total: number;
}
defineProps<Props>();
const emit = defineEmits<{ select: [optionId: number, on: boolean]; essay: [text: string]; flag: []; clear: [] }>();
</script>

<template>
  <section class="flex flex-col gap-4" :aria-label="`Soal ${index + 1} dari ${total}`">
    <header class="flex flex-wrap items-center gap-2">
      <h2 class="text-[13px] font-semibold">Soal {{ index + 1 }} <span class="text-muted-foreground font-normal">dari {{ total }}</span></h2>
      <span class="text-muted-foreground text-xs">{{ questionTypeLabels[question.type] }} · {{ question.points }} poin</span>
      <Button type="button" variant="ghost" size="sm" class="ml-auto" :aria-pressed="answer.flagged" :class="answer.flagged ? 'bg-accent' : 'text-muted-foreground'" @click="emit('flag')">
        <Flag :class="{ 'fill-current': answer.flagged }" />{{ answer.flagged ? "Ditandai" : "Tandai" }}
      </Button>
    </header>

    <p class="text-sm leading-relaxed whitespace-pre-wrap">{{ question.text }}</p>

    <RadioGroup v-if="question.type === 'single' || question.type === 'truefalse'" :model-value="answer.selected[0] === undefined ? '' : String(answer.selected[0])" class="flex flex-col gap-2" :aria-label="`Pilihan jawaban soal ${index + 1}`" @update:model-value="(v) => emit('select', Number(v), true)">
      <Label v-for="o in question.options" :key="o.id" :for="`opt-${o.id}`" class="hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm font-normal transition-colors">
        <RadioGroupItem :id="`opt-${o.id}`" :value="String(o.id)" class="mt-0.5" />
        <span class="leading-snug">{{ o.text }}</span>
      </Label>
    </RadioGroup>

    <div v-else-if="question.type === 'multiple'" class="flex flex-col gap-2" role="group" :aria-label="`Pilihan jawaban soal ${index + 1}, pilih semua yang benar`">
      <p class="text-muted-foreground text-xs">Pilih semua jawaban yang benar. Jawaban salah mengurangi nilai.</p>
      <Label v-for="o in question.options" :key="o.id" :for="`opt-${o.id}`" class="hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm font-normal transition-colors">
        <Checkbox :id="`opt-${o.id}`" :model-value="answer.selected.includes(o.id)" class="mt-0.5" @update:model-value="(v) => emit('select', o.id, v === true)" />
        <span class="leading-snug">{{ o.text }}</span>
      </Label>
    </div>

    <div v-else class="flex flex-col gap-1.5">
      <Label :for="`essay-${question.id}`" class="sr-only">Jawaban esai</Label>
      <Textarea :id="`essay-${question.id}`" :model-value="answer.essayText" rows="12" :maxlength="ESSAY_MAX" placeholder="Tulis jawabanmu di sini…" class="md:text-sm" @update:model-value="(v) => emit('essay', String(v))" />
      <p class="text-muted-foreground text-right text-xs">{{ answer.essayText.length.toLocaleString("id-ID") }} / {{ ESSAY_MAX.toLocaleString("id-ID") }}</p>
    </div>

    <Button v-if="question.type !== 'essay' && answer.selected.length" type="button" variant="ghost" size="sm" class="text-muted-foreground w-fit" @click="emit('clear')"><RotateCcw />Hapus jawaban</Button>
  </section>
</template>
