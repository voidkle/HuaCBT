<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2, Paperclip, X } from "lucide-vue-next";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/utils/formatBytes";
import { fromDatetimeLocal, toDatetimeLocal } from "@/utils/datetimeLocal";
import { MAX_FILES, type AssignmentDetail, type AssignmentInput, type NewAssignment, type Target } from "../types";

interface Props {
  /** null = a new assignment. */
  assignment: AssignmentDetail | null;
  targets: Target[];
  /** Per-file limit in MB, for a pre-check. */
  maxMb: number | null;
  submitting: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ create: [input: NewAssignment, files: File[]]; update: [input: AssignmentInput] }>();
const open = defineModel<boolean>("open", { required: true });

const classroom = ref("");
const subject = ref("");
const title = ref("");
const instructions = ref("");
const due = ref("");
const maxPoints = ref(100);
const allowLate = ref(true);
const files = ref<File[]>([]);
const input = ref<HTMLInputElement | null>(null);

const editing = computed(() => props.assignment !== null);
const classOptions = computed(() => props.targets.map((t) => ({ value: String(t.classroomId), label: t.classroomName })));
const subjectOptions = computed(() => (props.targets.find((t) => String(t.classroomId) === classroom.value)?.subjects ?? []).map((s) => ({ value: String(s.id), label: s.name })));
const tooBig = computed(() => (props.maxMb === null ? [] : files.value.filter((f) => f.size > props.maxMb! * 1024 * 1024)));
const valid = computed(
  () => title.value.trim() !== "" && fromDatetimeLocal(due.value) !== null && Number.isInteger(maxPoints.value) && maxPoints.value >= 1 && maxPoints.value <= 1000 && (editing.value || (classroom.value !== "" && subject.value !== "")) && tooBig.value.length === 0,
);

watch(open, (isOpen) => {
  if (!isOpen) return;
  const a = props.assignment;
  classroom.value = a ? String(a.classroomId) : "";
  subject.value = a ? String(a.subjectId) : "";
  title.value = a?.title ?? "";
  instructions.value = a?.instructions ?? "";
  due.value = toDatetimeLocal(a?.dueAt ?? new Date(Date.now() + 7 * 86_400_000));
  maxPoints.value = a?.maxPoints ?? 100;
  allowLate.value = a?.allowLate ?? true;
  files.value = [];
});
watch(classroom, () => !editing.value && (subject.value = ""));

function pick(e: Event) {
  const chosen = [...((e.target as HTMLInputElement).files ?? [])];
  files.value = [...files.value, ...chosen].slice(0, MAX_FILES);
  if (input.value) input.value.value = "";
}

function submit() {
  const dueAt = fromDatetimeLocal(due.value);
  if (!valid.value || !dueAt) return;
  const base = { title: title.value.trim(), instructions: instructions.value.trim(), dueAt, allowLate: allowLate.value, maxPoints: maxPoints.value };
  if (editing.value) emit("update", base);
  else emit("create", { ...base, classroomId: Number(classroom.value), subjectId: Number(subject.value) }, files.value);
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editing ? "Ubah tugas" : "Tugas baru" }}</DialogTitle>
        <DialogDescription>Siswa di kelas ini akan melihat tugas dan dapat mengumpulkan jawaban sampai tenggat.</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div v-if="!editing" class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label>Kelas</Label>
            <BaseSelect v-model="classroom" :options="classOptions" label="Kelas" placeholder="Pilih kelas" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Mata pelajaran</Label>
            <BaseSelect v-model="subject" :options="subjectOptions" label="Mata pelajaran" placeholder="Pilih mata pelajaran" :disabled="classroom === ''" />
          </div>
          <p v-if="targets.length === 0" class="text-muted-foreground text-xs sm:col-span-2">Anda belum mengajar mata pelajaran di kelas mana pun. Minta staf menambahkannya di Kelas &amp; Jadwal.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="as-title">Judul</Label>
          <Input id="as-title" v-model="title" maxlength="120" placeholder="mis. PR Bab 3: Pecahan" autocomplete="off" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="as-desc">Petunjuk</Label>
          <Textarea id="as-desc" v-model="instructions" rows="4" maxlength="5000" class="md:text-[13px]" />
        </div>
        <div class="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <div class="flex flex-col gap-1.5">
            <Label for="as-due">Tenggat</Label>
            <Input id="as-due" v-model="due" type="datetime-local" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="as-pts">Nilai maks.</Label>
            <Input id="as-pts" v-model.number="maxPoints" type="number" inputmode="numeric" min="1" max="1000" step="1" required />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Switch id="as-late" v-model="allowLate" />
          <Label for="as-late" class="flex flex-col items-start gap-0.5">
            Terima jawaban terlambat
            <span class="text-muted-foreground text-xs font-normal">Jika mati, pengumpulan ditolak setelah tenggat.</span>
          </Label>
        </div>

        <div v-if="!editing" class="flex flex-col gap-1.5">
          <Label>Lampiran (opsional, maks. {{ MAX_FILES }} berkas)</Label>
          <ul v-if="files.length" class="flex flex-col gap-1">
            <li v-for="(f, i) in files" :key="i" class="bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-xs">
              <span class="min-w-0 flex-1 truncate">{{ f.name }}</span>
              <span class="text-muted-foreground">{{ formatBytes(f.size) }}</span>
              <button type="button" class="hover:bg-background rounded p-0.5" :aria-label="`Buang ${f.name}`" @click="files.splice(i, 1)"><X class="size-3" /></button>
            </li>
          </ul>
          <p v-if="tooBig.length" class="text-destructive text-xs" role="alert">Berkas melebihi {{ maxMb }} MB: {{ tooBig.map((f) => f.name).join(", ") }}</p>
          <div>
            <input ref="input" type="file" multiple class="sr-only" tabindex="-1" aria-hidden="true" @change="pick" />
            <Button type="button" variant="outline" size="sm" :disabled="files.length >= MAX_FILES" @click="input?.click()"><Paperclip />Tambah berkas</Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting"><Loader2 v-if="submitting" class="animate-spin" />{{ editing ? "Simpan" : "Posting" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
