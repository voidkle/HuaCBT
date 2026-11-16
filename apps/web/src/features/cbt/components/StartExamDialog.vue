<script setup lang="ts">
import { ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/unwrap";
import { startAttempt } from "../services/cbtApi";
import { durationLabel } from "../services/examLabels";
import type { AvailableExam } from "../types";

interface Props {
  exam: AvailableExam | null;
}
const props = defineProps<Props>();
const open = defineModel<boolean>("open", { required: true });

const router = useRouter();
const token = ref("");
const starting = ref(false);
const problem = ref<string | null>(null);

watch(open, (isOpen) => {
  if (isOpen) {
    token.value = "";
    problem.value = null;
  }
});

async function start() {
  if (!props.exam || starting.value) return;
  starting.value = true;
  problem.value = null;
  try {
    const { attemptId } = await startAttempt(props.exam.id, token.value.trim() || undefined);
    await router.push(`/cbt/attempts/${attemptId}`);
  } catch (e) {
    problem.value = e instanceof ApiError || e instanceof Error ? e.message : "Gagal memulai ujian";
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="exam" class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="start">
        <DialogHeader>
          <DialogTitle>{{ exam.title }}</DialogTitle>
          <DialogDescription>{{ exam.description || "Baca petunjuk di bawah sebelum memulai." }}</DialogDescription>
        </DialogHeader>

        <ul class="bg-muted flex flex-col gap-1 rounded-lg px-3 py-2 text-xs">
          <li>{{ exam.questionCount }} soal · {{ exam.totalPoints }} poin</li>
          <li>Waktu: {{ durationLabel(exam.durationMinutes) }}<template v-if="exam.durationMinutes">. Waktu mulai berjalan setelah kamu menekan Mulai dan tidak berhenti walau kamu menutup halaman.</template></li>
          <li>Kesempatan: {{ exam.maxAttempts - exam.attemptsUsed }} dari {{ exam.maxAttempts }} tersisa</li>
          <li>Jawabanmu tersimpan otomatis.</li>
        </ul>

        <div v-if="exam.requiresToken" class="flex flex-col gap-1.5">
          <Label for="exam-start-token">Token ujian</Label>
          <Input id="exam-start-token" v-model="token" maxlength="40" autocomplete="off" autocapitalize="characters" class="font-mono tracking-wider uppercase" required />
          <p class="text-muted-foreground text-xs">Token diberikan oleh gurumu.</p>
        </div>

        <p v-if="problem" class="text-destructive text-sm" role="alert">{{ problem }}</p>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="starting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="starting || (exam.requiresToken && token.trim() === '')">
            <Loader2 v-if="starting" class="animate-spin" />
            Mulai ujian
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
