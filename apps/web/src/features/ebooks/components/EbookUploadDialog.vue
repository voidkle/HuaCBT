<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { FileText, Loader2, Upload } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/utils/formatBytes";
import { useEbookUpload } from "../composables/useEbookUpload";
import type { EbookUploadInput } from "../types";

interface Props {
  submitting: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ submit: [input: EbookUploadInput] }>();
const open = defineModel<boolean>("open", { required: true });

const { analyzing, problem, analyzed, analyze, reset, toInput } = useEbookUpload();

const fileInput = ref<HTMLInputElement | null>(null);
const title = ref("");
const description = ref("");
const coverPreview = ref<string | null>(null);

const valid = computed(() => analyzed.value !== null && title.value.trim() !== "");

function revokePreview() {
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value);
  coverPreview.value = null;
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  revokePreview();
  if (await analyze(file)) {
    if (!title.value.trim()) title.value = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    if (analyzed.value?.cover) coverPreview.value = URL.createObjectURL(analyzed.value.cover);
  }
}

function submit() {
  const payload = valid.value ? toInput(title.value, description.value) : null;
  if (payload) emit("submit", payload);
}

watch(open, (isOpen) => {
  if (isOpen) {
    reset();
    revokePreview();
    title.value = "";
    description.value = "";
  }
});
onBeforeUnmount(revokePreview);
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Unggah e-book</DialogTitle>
          <DialogDescription>Berkas PDF. Sampul dibuat otomatis dari halaman pertama.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-1.5">
          <Label>Berkas PDF</Label>
          <div class="flex items-center gap-3">
            <div class="bg-muted flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border">
              <img v-if="coverPreview" :src="coverPreview" alt="Pratinjau sampul" class="size-full object-cover" />
              <FileText v-else class="text-muted-foreground size-5" />
            </div>
            <div class="flex min-w-0 flex-col gap-1.5">
              <Button type="button" variant="outline" size="sm" class="w-fit" :disabled="analyzing || submitting" @click="fileInput?.click()">
                <Loader2 v-if="analyzing" class="animate-spin" />
                <Upload v-else />
                {{ analyzed ? "Ganti berkas" : "Pilih PDF" }}
              </Button>
              <p v-if="analyzing" class="text-muted-foreground text-xs">Membaca PDF…</p>
              <p v-else-if="analyzed" class="text-muted-foreground truncate text-xs">{{ analyzed.file.name }} · {{ analyzed.pageCount }} halaman · {{ formatBytes(analyzed.file.size) }}</p>
              <p v-if="problem" class="text-destructive text-xs" role="alert">{{ problem }}</p>
            </div>
            <input ref="fileInput" type="file" class="sr-only" accept="application/pdf,.pdf" aria-label="Pilih berkas PDF" @change="onPick" />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="ebook-title">Judul</Label>
          <Input id="ebook-title" v-model="title" maxlength="150" required autocomplete="off" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="ebook-desc">Deskripsi (opsional)</Label>
          <Textarea id="ebook-desc" v-model="description" maxlength="1000" rows="3" class="md:text-[13px]" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting || analyzing">
            <Loader2 v-if="submitting" class="animate-spin" />
            {{ submitting ? "Mengunggah…" : "Unggah" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
