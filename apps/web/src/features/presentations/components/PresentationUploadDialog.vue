<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { FileText, Loader2, Upload } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/utils/formatBytes";
import { fetchMaxPptMb } from "../services/presentationApi";
import { ACCEPTED_EXTENSIONS, type PresentationInput } from "../types";

interface Props {
  submitting: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ submit: [input: PresentationInput] }>();
const open = defineModel<boolean>("open", { required: true });

const MB = 1024 * 1024;
const tab = ref<"file" | "link">("file");
const fileInput = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const link = ref("");
const title = ref("");
const description = ref("");
const maxMb = ref(Infinity);
const problem = ref<string | null>(null);

const linkLooksOk = computed(() => /^https:\/\/\S+$/.test(link.value.trim()));
const valid = computed(() => title.value.trim() !== "" && (tab.value === "file" ? file.value !== null && problem.value === null : linkLooksOk.value));

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f) return;
  file.value = f;
  problem.value = !ACCEPTED_EXTENSIONS.test(f.name) ? "Berkas harus .pptx, .ppt, atau .odp." : f.size > maxMb.value * MB ? `Ukuran maksimal ${maxMb.value} MB (berkas ini ${formatBytes(f.size)}).` : null;
  if (!title.value.trim()) title.value = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function submit() {
  if (!valid.value) return;
  const base = { title: title.value.trim(), description: description.value.trim() };
  emit("submit", tab.value === "file" ? { ...base, file: file.value! } : { ...base, link: link.value.trim() });
}

watch(open, async (isOpen) => {
  if (!isOpen) return;
  tab.value = "file";
  file.value = null;
  link.value = "";
  title.value = "";
  description.value = "";
  problem.value = null;
  maxMb.value = await fetchMaxPptMb().catch(() => Infinity); // the server enforces it either way; this is just early feedback
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Tambah presentasi</DialogTitle>
          <DialogDescription>Unggah berkas PowerPoint (dikonversi di server, hanya bisa dibaca) atau tempel tautan Google Slides / Canva.</DialogDescription>
        </DialogHeader>

        <Tabs v-model="tab">
          <TabsList class="w-full"><TabsTrigger value="file">Berkas</TabsTrigger><TabsTrigger value="link">Tautan</TabsTrigger></TabsList>
          <TabsContent value="file" class="flex flex-col gap-1.5 pt-3">
            <Label>Berkas presentasi</Label>
            <div class="flex items-center gap-3">
              <div class="bg-muted flex size-12 shrink-0 items-center justify-center rounded-md border"><FileText class="text-muted-foreground size-5" /></div>
              <div class="flex min-w-0 flex-col gap-1.5">
                <Button type="button" variant="outline" size="sm" class="w-fit" :disabled="submitting" @click="fileInput?.click()"><Upload />{{ file ? "Ganti berkas" : "Pilih berkas" }}</Button>
                <p v-if="file" class="text-muted-foreground truncate text-xs">{{ file.name }} · {{ formatBytes(file.size) }}</p>
                <p v-else class="text-muted-foreground text-xs">.pptx, .ppt, atau .odp{{ Number.isFinite(maxMb) ? `, maksimal ${maxMb} MB` : "" }}</p>
                <p v-if="problem" class="text-destructive text-xs" role="alert">{{ problem }}</p>
              </div>
              <input ref="fileInput" type="file" class="sr-only" accept=".pptx,.ppt,.odp" aria-label="Pilih berkas presentasi" @change="onPick" />
            </div>
          </TabsContent>
          <TabsContent value="link" class="flex flex-col gap-1.5 pt-3">
            <Label for="deck-link">Tautan Google Slides atau Canva</Label>
            <Input id="deck-link" v-model="link" type="url" inputmode="url" placeholder="https://docs.google.com/presentation/d/…" autocomplete="off" />
            <p class="text-muted-foreground text-xs">Atur berbagi ke "Siapa saja yang memiliki link" (hanya melihat), kalau tidak siswa tidak bisa membukanya. Untuk Canva pakai tautan Lihat, bukan tautan edit.</p>
          </TabsContent>
        </Tabs>

        <div class="flex flex-col gap-1.5">
          <Label for="deck-title">Judul</Label>
          <Input id="deck-title" v-model="title" maxlength="150" required autocomplete="off" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="deck-desc">Deskripsi (opsional)</Label>
          <Textarea id="deck-desc" v-model="description" maxlength="1000" rows="3" class="md:text-[13px]" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting"><Loader2 v-if="submitting" class="animate-spin" />{{ submitting ? "Mengirim…" : tab === "file" ? "Unggah" : "Tambahkan" }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
