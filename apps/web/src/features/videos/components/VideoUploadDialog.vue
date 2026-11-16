<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { FileVideo, Loader2, Upload } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/composables/useToast";
import { formatBytes } from "@/utils/formatBytes";
import { useVideoUpload } from "../composables/useVideoUpload";
import type { VideoDetail } from "../types";

interface Props {
  /** Students' uploads wait for approval: say so before they start. */
  needsApproval: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ uploaded: [video: VideoDetail] }>();
const open = defineModel<boolean>("open", { required: true });

const toast = useToast();
const { progress, phase, busy, problem, start, cancel, reset, precheck } = useVideoUpload();

const fileInput = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const title = ref("");
const description = ref("");
const fileProblem = ref<string | null>(null);

const percent = computed(() => Math.round(progress.value * 100));
const valid = computed(() => file.value !== null && title.value.trim() !== "" && !fileProblem.value);

watch(open, (isOpen) => {
  if (!isOpen) return;
  file.value = null;
  title.value = "";
  description.value = "";
  fileProblem.value = null;
  reset();
});

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const picked = input.files?.[0];
  input.value = "";
  if (!picked) return;
  fileProblem.value = await precheck(picked);
  file.value = picked;
  if (!title.value.trim()) title.value = picked.name.replace(/\.(mp4|webm)$/i, "").replace(/[_-]+/g, " ").trim();
}

async function submit() {
  if (!valid.value || !file.value || busy.value) return;
  const video = await start(file.value, title.value, description.value);
  if (!video) return; // failed or cancelled: the dialog shows why
  toast.success(props.needsApproval ? "Video terkirim, menunggu persetujuan guru atau staf" : "Video dipublikasikan");
  emit("uploaded", video);
  open.value = false;
}

// closing mid-upload would leave the user guessing: ask them to cancel explicitly
const onOpenChange = (v: boolean) => {
  if (!v && busy.value) return;
  open.value = v;
};
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="sm:max-w-lg">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Unggah video</DialogTitle>
          <DialogDescription>
            MP4 (H.264/AAC) atau WebM (VP9/Opus).
            {{ needsApproval ? "Video akan tampil untuk siswa lain setelah disetujui guru atau staf." : "Video langsung dipublikasikan." }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-1.5">
          <Label>Berkas video</Label>
          <div class="flex items-center gap-3">
            <div class="bg-muted flex size-14 shrink-0 items-center justify-center rounded-md border"><FileVideo class="text-muted-foreground size-5" /></div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <Button type="button" variant="outline" size="sm" class="w-fit" :disabled="busy" @click="fileInput?.click()"><Upload />{{ file ? "Ganti berkas" : "Pilih video" }}</Button>
              <p v-if="file" class="text-muted-foreground truncate text-xs">{{ file.name }} · {{ formatBytes(file.size) }}</p>
              <p v-if="fileProblem" class="text-destructive text-xs" role="alert">{{ fileProblem }}</p>
            </div>
            <input ref="fileInput" type="file" class="sr-only" accept="video/mp4,video/webm,.mp4,.webm" aria-label="Pilih berkas video" @change="onPick" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="video-title">Judul</Label>
          <Input id="video-title" v-model="title" maxlength="150" required autocomplete="off" :disabled="busy" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="video-desc">Deskripsi (opsional)</Label>
          <Textarea id="video-desc" v-model="description" maxlength="2000" rows="3" class="md:text-[13px]" :disabled="busy" />
        </div>

        <div v-if="phase !== 'idle'" class="flex flex-col gap-1.5" aria-live="polite">
          <div class="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100" aria-label="Kemajuan unggahan">
            <div class="bg-primary h-full transition-[width]" :class="{ 'animate-pulse': phase === 'processing' }" :style="{ width: `${phase === 'processing' ? 100 : percent}%` }" />
          </div>
          <p class="text-muted-foreground text-xs">{{ phase === "processing" ? "Memeriksa dan memproses video…" : `Mengunggah… ${percent}%` }}</p>
        </div>
        <p v-if="problem" class="text-destructive text-sm" role="alert">{{ problem }}</p>

        <DialogFooter>
          <Button v-if="busy" type="button" variant="outline" :disabled="phase === 'processing'" @click="cancel">Batalkan unggahan</Button>
          <Button v-else type="button" variant="outline" @click="open = false">Tutup</Button>
          <Button type="submit" :disabled="!valid || busy">
            <Loader2 v-if="busy" class="animate-spin" />
            Unggah
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
