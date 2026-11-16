<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Captions, Loader2, Sparkles, Trash2, Upload } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VideoDetail, VideoFeatureFlags } from "../types";

interface Props {
  video: VideoDetail;
  flags: VideoFeatureFlags | null;
  /** Paid/heavy actions (automatic transcript, AI summary) are for teacher, staff, admin and operator only. */
  canAi: boolean;
  busy: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ transcript: []; summary: []; clear: []; captions: [file: File]; save: [title: string, description: string] }>();

const fileInput = ref<HTMLInputElement | null>(null);
const title = ref(props.video.title);
const description = ref(props.video.description);
watch(
  () => [props.video.title, props.video.description] as const,
  ([t, d]) => {
    title.value = t;
    description.value = d;
  },
);

const jobRunning = (s: string) => s === "queued" || s === "processing";
const transcriptRunning = computed(() => jobRunning(props.video.transcriptStatus));
const summaryRunning = computed(() => jobRunning(props.video.summaryStatus));

/** Why a button is off, shown under it instead of leaving the user guessing. */
const transcriptBlocked = computed(() => (!props.canAi ? "Hanya guru, staf, admin, atau operator." : !props.flags?.transcriptionEnabled ? "Transkrip otomatis belum diaktifkan di halaman Pengaturan." : null));
const summaryBlocked = computed(() =>
  !props.canAi ? "Hanya guru, staf, admin, atau operator." : !props.flags?.aiSummaryEnabled ? "Ringkasan AI belum diaktifkan di halaman Pengaturan." : props.video.transcriptStatus !== "ready" ? "Buat atau unggah transkrip dulu." : null,
);
const dirty = computed(() => title.value.trim() !== props.video.title || description.value.trim() !== props.video.description);

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (f) emit("captions", f);
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <section class="flex flex-col gap-2" aria-label="Detail video">
      <form class="flex flex-col gap-2" @submit.prevent="emit('save', title.trim(), description.trim())">
        <Label for="manage-title">Judul</Label>
        <Input id="manage-title" v-model="title" maxlength="150" required autocomplete="off" />
        <Label for="manage-desc">Deskripsi</Label>
        <Textarea id="manage-desc" v-model="description" maxlength="2000" rows="3" class="md:text-[13px]" />
        <Button type="submit" size="sm" class="w-fit" :disabled="!dirty || busy || title.trim() === ''">Simpan</Button>
        <p v-if="video.approval === 'approved'" class="text-muted-foreground text-xs">Jika kamu siswa, perubahan membuat video menunggu persetujuan lagi.</p>
      </form>
    </section>

    <section class="flex flex-col gap-2 border-t pt-4" aria-label="Transkrip">
      <h3 class="text-[13px] font-medium">Transkrip dan teks pendamping</h3>
      <p class="text-muted-foreground text-xs">
        {{ video.transcriptStatus === "ready" ? `Tersedia (${video.transcriptSource === "auto" ? "otomatis" : "dari berkas"}).` : transcriptRunning ? "Sedang diproses…" : video.transcriptStatus === "failed" ? "Gagal dibuat." : "Belum ada." }}
        Siswa tunarungu memakainya sebagai teks pendamping.
      </p>
      <p v-if="video.transcriptError" class="text-destructive text-xs" role="alert">{{ video.transcriptError }}</p>
      <div class="flex flex-wrap gap-2">
        <Button type="button" size="sm" :disabled="busy || transcriptRunning || transcriptBlocked !== null" @click="emit('transcript')"><Loader2 v-if="transcriptRunning" class="animate-spin" /><Captions v-else />Buat otomatis</Button>
        <Button type="button" size="sm" variant="outline" :disabled="busy || transcriptRunning" @click="fileInput?.click()"><Upload />Unggah .vtt / .srt</Button>
        <Button v-if="video.transcriptStatus !== 'none'" type="button" size="sm" variant="ghost" class="text-destructive" :disabled="busy || transcriptRunning" @click="emit('clear')"><Trash2 />Hapus</Button>
        <input ref="fileInput" type="file" class="sr-only" accept=".vtt,.srt,text/vtt,application/x-subrip,text/plain" aria-label="Pilih berkas teks pendamping" @change="onPick" />
      </div>
      <p v-if="transcriptBlocked" class="text-muted-foreground text-xs">Otomatis: {{ transcriptBlocked }} Unggah berkas teks tetap gratis.</p>
    </section>

    <section class="flex flex-col gap-2 border-t pt-4" aria-label="Ringkasan AI">
      <h3 class="text-[13px] font-medium">Ringkasan AI</h3>
      <p class="text-muted-foreground text-xs">Membuat ringkasan dan bab berstempel waktu dari transkrip. Layanan AI berbayar; hanya jalan saat kamu menekan tombol.</p>
      <p v-if="video.summaryError" class="text-destructive text-xs" role="alert">{{ video.summaryError }}</p>
      <Button type="button" size="sm" class="w-fit" :disabled="busy || summaryRunning || summaryBlocked !== null" @click="emit('summary')"><Loader2 v-if="summaryRunning" class="animate-spin" /><Sparkles v-else />{{ video.summary ? "Buat ulang ringkasan" : "Buat ringkasan" }}</Button>
      <p v-if="summaryBlocked" class="text-muted-foreground text-xs">{{ summaryBlocked }}</p>
    </section>
  </div>
</template>
