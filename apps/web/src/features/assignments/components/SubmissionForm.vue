<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2, Paperclip, X } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/utils/formatBytes";
import { formatDateTime } from "@/utils/formatDate";
import { MAX_FILES, MAX_TEXT, type AssignmentDetail, type FileInfo, type SubmissionInput } from "../types";
import FileList from "./FileList.vue";

interface Props {
  assignment: AssignmentDetail;
  /** Per-file limit in MB, for a pre-check. */
  maxMb: number | null;
  busy: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ submit: [input: SubmissionInput] }>();

const mine = computed(() => props.assignment.mine);
const text = ref("");
const kept = ref<FileInfo[]>([]);
const added = ref<File[]>([]);
const picker = ref<HTMLInputElement | null>(null);

const graded = computed(() => mine.value?.status === "graded");
const closed = computed(() => !props.assignment.allowLate && props.assignment.dueAt < new Date());
const readOnly = computed(() => graded.value || closed.value);
const total = computed(() => kept.value.length + added.value.length);
const tooBig = computed(() => (props.maxMb === null ? [] : added.value.filter((f) => f.size > props.maxMb! * 1024 * 1024)));
const valid = computed(() => (text.value.trim() !== "" || total.value > 0) && total.value <= MAX_FILES && text.value.length <= MAX_TEXT && tooBig.value.length === 0);
const late = computed(() => props.assignment.dueAt < new Date());

// start from what is already sent; refresh when the answer is reloaded
watch(
  () => props.assignment.mine,
  (m) => {
    text.value = m?.text ?? "";
    kept.value = [...(m?.files ?? [])];
    added.value = [];
  },
  { immediate: true },
);

function pick(e: Event) {
  const chosen = [...((e.target as HTMLInputElement).files ?? [])];
  added.value = [...added.value, ...chosen].slice(0, MAX_FILES - kept.value.length);
  if (picker.value) picker.value.value = "";
}
const submit = () => valid.value && emit("submit", { text: text.value, keep: kept.value.map((f) => f.id), files: added.value });
</script>

<template>
  <section class="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs" aria-labelledby="answer-h">
    <div class="flex flex-wrap items-center gap-2">
      <h2 id="answer-h" class="text-sm font-semibold">Jawaban saya</h2>
      <Badge v-if="graded" variant="secondary">Sudah dinilai</Badge>
      <Badge v-else-if="mine" variant="outline" :class="mine.late ? 'text-destructive border-destructive/40' : ''">{{ mine.late ? "Terkirim terlambat" : "Terkirim" }}</Badge>
      <span v-if="mine" class="text-muted-foreground text-xs">{{ formatDateTime(mine.submittedAt) }}</span>
    </div>

    <div v-if="graded && mine" class="bg-muted flex flex-col gap-1 rounded-lg p-3" role="status">
      <p class="text-base font-semibold">{{ mine.score }} <span class="text-muted-foreground text-sm font-normal">/ {{ assignment.maxPoints }}</span></p>
      <p v-if="mine.feedback" class="text-sm whitespace-pre-wrap">{{ mine.feedback }}</p>
      <p v-else class="text-muted-foreground text-xs">Tanpa catatan dari guru.</p>
    </div>
    <p v-else-if="closed" class="text-muted-foreground text-sm" role="status">Pengumpulan sudah ditutup.{{ mine ? "" : " Anda tidak mengumpulkan jawaban." }}</p>
    <p v-else-if="late" class="text-destructive text-xs" role="status">Tenggat sudah lewat. Jawaban akan ditandai terlambat.</p>

    <template v-if="readOnly">
      <p v-if="mine?.text" class="text-sm whitespace-pre-wrap">{{ mine.text }}</p>
      <FileList v-if="mine" :files="mine.files" />
    </template>
    <form v-else class="flex flex-col gap-3" @submit.prevent="submit">
      <div class="flex flex-col gap-1.5">
        <Label for="ans-text">Jawaban</Label>
        <Textarea id="ans-text" v-model="text" rows="6" :maxlength="MAX_TEXT" class="md:text-[13px]" placeholder="Tulis jawaban di sini, dan/atau lampirkan berkas" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label>Berkas ({{ total }}/{{ MAX_FILES }})</Label>
        <FileList :files="kept" removable :disabled="busy" @remove="(f: FileInfo) => (kept = kept.filter((k) => k.id !== f.id))" />
        <ul v-if="added.length" class="flex flex-col gap-1">
          <li v-for="(f, i) in added" :key="i" class="bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-xs">
            <span class="min-w-0 flex-1 truncate">{{ f.name }}</span>
            <span class="text-muted-foreground">{{ formatBytes(f.size) }}</span>
            <button type="button" class="hover:bg-background rounded p-0.5" :aria-label="`Buang ${f.name}`" @click="added.splice(i, 1)"><X class="size-3" /></button>
          </li>
        </ul>
        <p v-if="tooBig.length" class="text-destructive text-xs" role="alert">Berkas melebihi {{ maxMb }} MB: {{ tooBig.map((f) => f.name).join(", ") }}</p>
        <div>
          <input ref="picker" type="file" multiple class="sr-only" tabindex="-1" aria-hidden="true" @change="pick" />
          <Button type="button" variant="outline" size="sm" :disabled="total >= MAX_FILES || busy" @click="picker?.click()"><Paperclip />Tambah berkas</Button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button type="submit" :disabled="!valid || busy"><Loader2 v-if="busy" class="animate-spin" />{{ mine ? "Kirim ulang" : "Kumpulkan" }}</Button>
        <span v-if="mine" class="text-muted-foreground text-xs">Mengirim ulang menggantikan jawaban sebelumnya.</span>
      </div>
    </form>
  </section>
</template>
