<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Link2, Loader2, Paperclip, Send, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/utils/formatBytes";
import { useToast } from "@/composables/useToast";
import { fetchMaxChatMediaMb } from "../services/chatApi";
import { linkPositionLabel } from "../services/linkTarget";
import { MESSAGE_MAX, type LinkTarget, type SendInput } from "../types";
import LinkPickerDialog from "./LinkPickerDialog.vue";

interface Props {
  /** Resolves true when the message was sent (the composer then clears itself). */
  send: (input: SendInput) => Promise<boolean>;
  sending: boolean;
}
const props = defineProps<Props>();

const toast = useToast();
const text = ref("");
const file = ref<File | null>(null);
const link = ref<{ target: LinkTarget; title: string } | null>(null);
const pickerOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const field = ref<InstanceType<typeof Textarea> | null>(null);
const maxMb = ref<number | null>(null);

const rows = computed(() => Math.min(5, text.value.split("\n").length));
const canSend = computed(() => !props.sending && (text.value.trim() !== "" || file.value !== null || link.value !== null));

function pickFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const picked = input.files?.[0];
  input.value = "";
  if (!picked) return;
  if (maxMb.value !== null && picked.size > maxMb.value * 1024 * 1024) {
    toast.error(`Ukuran berkas maksimal ${maxMb.value} MB (berkas ini ${formatBytes(picked.size)})`);
    return;
  }
  file.value = picked;
}

async function submit() {
  if (!canSend.value) return;
  const ok = await props.send({ text: text.value.trim(), file: file.value ?? undefined, link: link.value?.target });
  if (ok) {
    text.value = "";
    file.value = null;
    link.value = null;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void submit();
  }
}

onMounted(() => void fetchMaxChatMediaMb().then((v) => (maxMb.value = v)).catch(() => undefined)); // pre-check only; the server enforces it
</script>

<template>
  <form class="flex flex-col gap-2 border-t p-3" @submit.prevent="submit">
    <div v-if="file || link" class="flex flex-wrap gap-1.5">
      <span v-if="file" class="bg-muted inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs">
        <Paperclip class="size-3 shrink-0" /><span class="truncate">{{ file.name }} · {{ formatBytes(file.size) }}</span>
        <button type="button" class="text-muted-foreground hover:text-foreground" aria-label="Lepas berkas" @click="file = null"><X class="size-3" /></button>
      </span>
      <span v-if="link" class="bg-muted inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs">
        <Link2 class="size-3 shrink-0" /><span class="truncate">{{ link.title }} · {{ linkPositionLabel(link.target) }}</span>
        <button type="button" class="text-muted-foreground hover:text-foreground" aria-label="Lepas tautan" @click="link = null"><X class="size-3" /></button>
      </span>
    </div>

    <div class="flex items-end gap-1.5">
      <Button type="button" variant="ghost" size="icon" class="text-muted-foreground shrink-0" aria-label="Lampirkan berkas" title="Lampirkan berkas" @click="fileInput?.click()"><Paperclip class="size-4" /></Button>
      <Button type="button" variant="ghost" size="icon" class="text-muted-foreground shrink-0" aria-label="Sertakan tautan e-book" title="Sertakan tautan e-book" @click="pickerOpen = true"><Link2 class="size-4" /></Button>
      <Textarea ref="field" v-model="text" :rows="rows" :maxlength="MESSAGE_MAX" placeholder="Tulis pesan…" aria-label="Tulis pesan" class="max-h-32 min-h-9 flex-1 resize-none py-2 md:text-[13px]" @keydown="onKeydown" />
      <Button type="submit" size="icon" class="shrink-0" :disabled="!canSend" aria-label="Kirim pesan">
        <Loader2 v-if="sending" class="animate-spin" />
        <Send v-else class="size-4" />
      </Button>
      <input ref="fileInput" type="file" class="sr-only" aria-label="Pilih berkas lampiran" @change="pickFile" />
    </div>

    <LinkPickerDialog v-model:open="pickerOpen" @pick="link = $event" />
  </form>
</template>
