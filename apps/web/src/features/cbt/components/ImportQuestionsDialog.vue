<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuestionImport } from "../composables/useQuestionImport";
import { importTemplateUrl } from "../services/cbtApi";
import { MAX_QUESTIONS, questionTypeLabels, type ImportPreview } from "../types";

interface Props {
  /** Questions already in the draft; imported ones are appended after them. */
  existing: number;
}
const props = defineProps<Props>();
const emit = defineEmits<{ import: [questions: ImportPreview["questions"]] }>();
const open = defineModel<boolean>("open", { required: true });

const { preview, fileName, parsing, failure, parse, reset } = useQuestionImport();
const fileInput = ref<HTMLInputElement | null>(null);

const count = computed(() => preview.value?.questions.length ?? 0);
const errors = computed(() => preview.value?.errors ?? []);
const overCap = computed(() => props.existing + count.value > MAX_QUESTIONS);
const canImport = computed(() => count.value > 0 && errors.value.length === 0 && !overCap.value);
const totalPoints = computed(() => preview.value?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0);
const typeSummary = computed(() => {
  const n: Record<string, number> = {};
  for (const q of preview.value?.questions ?? []) n[q.type] = (n[q.type] ?? 0) + 1;
  return Object.entries(n).map(([t, c]) => `${c} ${questionTypeLabels[t as keyof typeof questionTypeLabels].toLowerCase()}`).join(", ");
});

watch(open, (o) => o || reset());

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (f) void parse(f);
}

function confirm() {
  if (!preview.value || !canImport.value) return;
  emit("import", preview.value.questions);
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Impor soal dari Excel</DialogTitle>
        <DialogDescription>Soal ditambahkan ke daftar di bawah soal yang sudah ada dan baru tersimpan setelah kamu menekan Simpan.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <Button as-child variant="outline" size="sm" class="w-fit"><a :href="importTemplateUrl" download><Download />Unduh templat (.xlsx)</a></Button>

        <div class="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" :disabled="parsing" @click="fileInput?.click()"><Loader2 v-if="parsing" class="animate-spin" /><Upload v-else />{{ preview || failure ? "Ganti berkas" : "Pilih berkas .xlsx" }}</Button>
          <span v-if="fileName" class="text-muted-foreground flex min-w-0 items-center gap-1 text-xs"><FileSpreadsheet class="size-3.5 shrink-0" /><span class="truncate">{{ fileName }}</span></span>
          <input ref="fileInput" type="file" class="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Pilih berkas Excel soal" @change="onPick" />
        </div>

        <p v-if="failure" class="text-destructive text-xs" role="alert">{{ failure }}</p>

        <div v-if="preview" class="flex flex-col gap-2" role="status">
          <p v-if="count > 0 && errors.length === 0" class="text-[13px]">
            <strong>{{ count }} soal</strong> siap diimpor ({{ typeSummary }}; {{ totalPoints }} poin).
          </p>
          <p v-if="overCap" class="text-destructive text-xs" role="alert">Total soal akan melebihi {{ MAX_QUESTIONS }} (sudah ada {{ existing }}).</p>
          <div v-if="errors.length" class="flex flex-col gap-1">
            <p class="text-destructive text-xs font-medium" role="alert">{{ errors.length }} masalah ditemukan. Perbaiki berkasnya lalu pilih ulang; tidak ada soal yang diimpor sebagian.</p>
            <ul class="max-h-48 overflow-y-auto rounded-lg border text-xs" aria-label="Daftar masalah">
              <li v-for="(e, i) in errors" :key="i" class="flex gap-2 border-b px-2.5 py-1.5 last:border-b-0">
                <span class="text-muted-foreground w-16 shrink-0 tabular-nums">{{ e.row ? `Baris ${e.row}` : "Berkas" }}</span><span>{{ e.message }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" @click="open = false">Batal</Button>
        <Button type="button" :disabled="!canImport" @click="confirm">Impor{{ canImport ? ` ${count} soal` : "" }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
