<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/utils/formatDate";
import type { SubmissionDetail } from "../types";
import FileList from "./FileList.vue";

interface Props {
  /** The open answer; the dialog is shown while this is set. */
  submission: SubmissionDetail | null;
  busy: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ grade: [score: number, feedback: string]; reopen: []; close: [] }>();

const score = ref<number | string>("");
const feedback = ref("");

const max = computed(() => props.submission?.assignment.maxPoints ?? 100);
const graded = computed(() => props.submission?.status === "graded");
const valid = computed(() => score.value !== "" && Number.isFinite(Number(score.value)) && Number(score.value) >= 0 && Number(score.value) <= max.value);

watch(
  () => props.submission,
  (s) => {
    score.value = s?.score ?? "";
    feedback.value = s?.feedback ?? "";
  },
  { immediate: true },
);

const submit = () => valid.value && emit("grade", Number(score.value), feedback.value);
</script>

<template>
  <Dialog :open="submission !== null" @update:open="(v: boolean) => !v && emit('close')">
    <DialogContent v-if="submission" class="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ submission.student.name }}</DialogTitle>
        <DialogDescription>
          {{ submission.assignment.title }} · dikirim {{ formatDateTime(submission.submittedAt) }}
          <Badge v-if="submission.late" variant="outline" class="text-destructive border-destructive/40 ml-1 text-[11px]">Terlambat</Badge>
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <p v-if="submission.text" class="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">{{ submission.text }}</p>
        <p v-else class="text-muted-foreground text-xs">Tidak ada jawaban teks.</p>
        <FileList :files="submission.files" />
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <div class="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <div class="flex flex-col gap-1.5">
            <Label for="gr-score">Nilai (0–{{ max }})</Label>
            <Input id="gr-score" v-model="score" type="number" inputmode="decimal" min="0" :max="max" step="0.5" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="gr-fb">Catatan untuk siswa</Label>
            <Textarea id="gr-fb" v-model="feedback" rows="3" maxlength="2000" class="md:text-[13px]" />
          </div>
        </div>
        <DialogFooter class="gap-2 sm:justify-between">
          <Button v-if="graded" type="button" variant="outline" :disabled="busy" @click="emit('reopen')">Buka kembali untuk revisi</Button>
          <span v-else />
          <span class="flex gap-2">
            <Button type="button" variant="outline" :disabled="busy" @click="emit('close')">Tutup</Button>
            <Button type="submit" :disabled="!valid || busy"><Loader2 v-if="busy" class="animate-spin" />{{ graded ? "Perbarui nilai" : "Simpan nilai" }}</Button>
          </span>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
