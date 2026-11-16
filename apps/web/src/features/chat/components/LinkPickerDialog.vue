<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { BookOpen, Check, Loader2, Play, Presentation } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDuration, parseDuration } from "@/utils/formatDuration";
import { ebookCoverUrl, fetchLinkables, slideCoverUrl, videoPosterUrl } from "../services/chatApi";
import type { LinkableEbook, LinkablePresentation, LinkableVideo, LinkTarget, LinkType } from "../types";

const emit = defineEmits<{ pick: [link: { target: LinkTarget; title: string }] }>();
const open = defineModel<boolean>("open", { required: true });

const kind = ref<LinkType>("ebook");
const ebooks = ref<LinkableEbook[]>([]);
const videos = ref<LinkableVideo[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selectedBook = ref<LinkableEbook | null>(null);
const slides = ref<LinkablePresentation[]>([]);
const selectedVideo = ref<LinkableVideo | null>(null);
const selectedSlide = ref<LinkablePresentation | null>(null);
const page = ref(1);
const time = ref("0:00");

const maxPage = computed(() => selectedBook.value?.pageCount ?? 1);
const maxSlide = computed(() => selectedSlide.value?.pageCount ?? 1);
const seconds = computed(() => parseDuration(time.value));
const valid = computed(() => {
  if (kind.value === "ebook") return selectedBook.value !== null && Number.isInteger(page.value) && page.value >= 1 && page.value <= maxPage.value;
  if (kind.value === "slide") return selectedSlide.value !== null && Number.isInteger(page.value) && page.value >= 1 && page.value <= maxSlide.value;
  return selectedVideo.value !== null && seconds.value !== null && seconds.value <= selectedVideo.value.durationSec;
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchLinkables();
    ebooks.value = data.ebooks;
    videos.value = data.videos;
    slides.value = data.presentations;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Gagal memuat daftar";
  } finally {
    loading.value = false;
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return;
  selectedBook.value = null;
  selectedVideo.value = null;
  selectedSlide.value = null;
  page.value = 1;
  time.value = "0:00";
  void load();
});

function chooseBook(b: LinkableEbook) {
  selectedBook.value = b;
  page.value = 1;
}
function chooseSlide(d: LinkablePresentation) {
  selectedSlide.value = d;
  page.value = 1;
}
function chooseVideo(v: LinkableVideo) {
  selectedVideo.value = v;
  time.value = "0:00";
}

function submit() {
  if (!valid.value) return;
  if (kind.value === "ebook" && selectedBook.value) emit("pick", { target: { type: "ebook", ref: selectedBook.value.id, page: page.value }, title: selectedBook.value.title });
  else if (kind.value === "slide" && selectedSlide.value) emit("pick", { target: { type: "slide", ref: selectedSlide.value.id, page: page.value }, title: selectedSlide.value.title });
  else if (selectedVideo.value && seconds.value !== null) emit("pick", { target: { type: "video", ref: selectedVideo.value.id, page: seconds.value }, title: selectedVideo.value.title });
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>Sertakan tautan</DialogTitle>
          <DialogDescription>Penerima langsung dibawa ke halaman atau menit yang kamu pilih.</DialogDescription>
        </DialogHeader>

        <Tabs v-model="kind">
          <TabsList class="w-full">
            <TabsTrigger value="ebook">E-book</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="slide">Presentasi</TabsTrigger>
          </TabsList>
        </Tabs>

        <div v-if="loading" class="flex justify-center py-8"><Loader2 class="text-muted-foreground size-5 animate-spin" /></div>
        <p v-else-if="error" class="text-destructive text-sm" role="alert">{{ error }}</p>

        <template v-else-if="kind === 'ebook'">
          <p v-if="ebooks.length === 0" class="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">Belum ada e-book di perpustakaan.</p>
          <ul v-else class="flex max-h-64 flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label="Pilih e-book">
            <li v-for="b in ebooks" :key="b.id">
              <button type="button" role="option" :aria-selected="selectedBook?.id === b.id" class="hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors" :class="{ 'border-primary bg-accent': selectedBook?.id === b.id }" @click="chooseBook(b)">
                <div class="bg-muted flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded">
                  <img v-if="b.hasCover" :src="ebookCoverUrl(b.id)" :alt="`Sampul ${b.title}`" loading="lazy" class="size-full object-cover" />
                  <BookOpen v-else class="text-muted-foreground size-4" />
                </div>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-[13px] font-medium">{{ b.title }}</span>
                  <span class="text-muted-foreground text-xs">{{ b.pageCount }} halaman</span>
                </span>
                <Check v-if="selectedBook?.id === b.id" class="text-primary size-4 shrink-0" />
              </button>
            </li>
          </ul>
          <div v-if="selectedBook" class="flex flex-col gap-1.5">
            <Label for="link-page">Halaman (1 sampai {{ maxPage }})</Label>
            <Input id="link-page" v-model.number="page" type="number" inputmode="numeric" min="1" :max="maxPage" step="1" required class="w-32" />
          </div>
        </template>

        <template v-else-if="kind === 'slide'">
          <p v-if="slides.length === 0" class="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">Belum ada presentasi yang tersedia.</p>
          <ul v-else class="flex max-h-64 flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label="Pilih presentasi">
            <li v-for="d in slides" :key="d.id">
              <button type="button" role="option" :aria-selected="selectedSlide?.id === d.id" class="hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors" :class="{ 'border-primary bg-accent': selectedSlide?.id === d.id }" @click="chooseSlide(d)">
                <div class="bg-muted flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded">
                  <img v-if="d.hasCover" :src="slideCoverUrl(d.id)" :alt="`Slide pertama ${d.title}`" loading="lazy" class="size-full object-cover" />
                  <Presentation v-else class="text-muted-foreground size-4" />
                </div>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-[13px] font-medium">{{ d.title }}</span>
                  <span class="text-muted-foreground text-xs">{{ d.pageCount ? `${d.pageCount} slide` : d.kind === "google" ? "Google Slides" : "Canva" }}</span>
                </span>
                <Check v-if="selectedSlide?.id === d.id" class="text-primary size-4 shrink-0" />
              </button>
            </li>
          </ul>
          <div v-if="selectedSlide?.pageCount" class="flex flex-col gap-1.5">
            <Label for="link-slide">Slide (1 sampai {{ maxSlide }})</Label>
            <Input id="link-slide" v-model.number="page" type="number" inputmode="numeric" min="1" :max="maxSlide" step="1" required class="w-32" />
          </div>
        </template>

        <template v-else>
          <p v-if="videos.length === 0" class="text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">Belum ada video yang tersedia.</p>
          <ul v-else class="flex max-h-64 flex-col gap-1.5 overflow-y-auto" role="listbox" aria-label="Pilih video">
            <li v-for="v in videos" :key="v.id">
              <button type="button" role="option" :aria-selected="selectedVideo?.id === v.id" class="hover:bg-accent flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors" :class="{ 'border-primary bg-accent': selectedVideo?.id === v.id }" @click="chooseVideo(v)">
                <div class="bg-muted flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded">
                  <img v-if="v.hasPoster" :src="videoPosterUrl(v.id)" :alt="`Poster ${v.title}`" loading="lazy" class="size-full object-cover" />
                  <Play v-else class="text-muted-foreground size-4" />
                </div>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-[13px] font-medium">{{ v.title }}</span>
                  <span class="text-muted-foreground text-xs">{{ formatDuration(v.durationSec) }}</span>
                </span>
                <Check v-if="selectedVideo?.id === v.id" class="text-primary size-4 shrink-0" />
              </button>
            </li>
          </ul>
          <div v-if="selectedVideo" class="flex flex-col gap-1.5">
            <Label for="link-time">Mulai dari menit (0:00 sampai {{ formatDuration(selectedVideo.durationSec) }})</Label>
            <Input id="link-time" v-model="time" inputmode="numeric" placeholder="12:30" autocomplete="off" required class="w-32 tabular-nums" />
            <p v-if="seconds === null" class="text-destructive text-xs" role="alert">Tulis seperti 90, 1:30, atau 1:02:03.</p>
            <p v-else-if="seconds > selectedVideo.durationSec" class="text-destructive text-xs" role="alert">Melebihi durasi video.</p>
          </div>
        </template>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid">Sertakan</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
