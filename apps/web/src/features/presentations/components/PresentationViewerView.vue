<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Loader2, Maximize, Minimize, Presentation as PresentationIcon, Share2 } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import PdfPagedView from "@/components/PdfPagedView.vue";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePresentationViewer } from "../composables/usePresentationViewer";
import { type SlideTransition, TRANSITIONS } from "../types";

interface Props {
  deckId: number;
  /** From a shared link (?page=N); overrides the saved slide. */
  startPage: number | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{ share: [payload: { deckId: number; title: string; page: number }] }>();

const { deck, pdf, numPages, aspect, page, loading, loadProgress, error, transition, setTransition, setPage, load } = usePresentationViewer(props.deckId, props.startPage);

interface Stage {
  next: () => void;
  prev: () => void;
}
const stage = ref<Stage | null>(null);
const wrap = ref<HTMLElement | null>(null);

const converting = computed(() => deck.value?.status === "converting");
const failed = computed(() => deck.value?.status === "failed");
const embed = computed(() => (deck.value?.status === "ready" ? deck.value.embedUrl : null));
const sharePage = computed(() => (pdf.value ? page.value : 1));
const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

const presenting = ref(false);
const sync = () => (presenting.value = document.fullscreenElement !== null && document.fullscreenElement === wrap.value);
// "Presentasi": only the stage goes fullscreen, so the bars are gone and the keys/taps keep working
const togglePresent = () => (document.fullscreenElement ? document.exitFullscreen() : wrap.value?.requestFullscreen())?.catch(() => undefined);
onMounted(() => document.addEventListener("fullscreenchange", sync));
onBeforeUnmount(() => document.removeEventListener("fullscreenchange", sync));
</script>

<template>
  <div class="bg-muted flex h-svh flex-col">
    <header class="bg-background flex h-12 shrink-0 items-center gap-1 border-b px-2">
      <Button as-child variant="ghost" size="icon" aria-label="Kembali ke daftar presentasi" title="Kembali ke daftar presentasi"><RouterLink to="/presentations"><ArrowLeft class="size-4" /></RouterLink></Button>
      <h1 class="min-w-0 flex-1 truncate px-1 text-[13px] font-medium">{{ deck?.title ?? "" }}</h1>
      <Select v-if="pdf" :model-value="transition" @update:model-value="(v) => setTransition(v as SlideTransition)">
        <SelectTrigger size="sm" class="w-[7.5rem] text-xs" aria-label="Transisi antar slide" title="Transisi antar slide"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem v-for="t in TRANSITIONS" :key="t.value" :value="t.value">{{ t.label }}</SelectItem></SelectContent>
      </Select>
      <Button v-if="deck?.link" as-child variant="ghost" size="icon" class="text-muted-foreground" aria-label="Buka di tab baru" title="Buka di tab baru"><a :href="deck.link" target="_blank" rel="noopener noreferrer"><ExternalLink class="size-4" /></a></Button>
      <Button variant="ghost" size="icon" class="text-muted-foreground" :disabled="deck?.status !== 'ready'" aria-label="Bagikan slide ini ke chat" title="Bagikan slide ini ke chat" @click="deck && emit('share', { deckId: props.deckId, title: deck.title, page: sharePage })"><Share2 class="size-4" /></Button>
      <Button v-if="canFullscreen" size="sm" class="ml-1" :disabled="deck?.status !== 'ready'" @click="togglePresent"><PresentationIcon />Presentasi</Button>
    </header>

    <main ref="wrap" class="relative min-h-0 flex-1 overflow-hidden" :class="presenting ? 'bg-black' : ''">
      <div v-if="loading" class="flex size-full flex-col items-center justify-center gap-2" aria-busy="true">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
        <p class="text-muted-foreground text-xs">Memuat presentasi{{ loadProgress > 0 ? ` ${Math.round(loadProgress * 100)}%` : "…" }}</p>
      </div>

      <div v-else-if="error" class="flex size-full flex-col items-center justify-center gap-3 p-4 text-center" role="alert">
        <p class="text-destructive text-sm">{{ error }}</p>
        <div class="flex gap-2"><Button variant="outline" @click="load">Coba lagi</Button><Button as-child variant="outline"><RouterLink to="/presentations">Kembali</RouterLink></Button></div>
      </div>

      <div v-else-if="converting" class="flex size-full flex-col items-center justify-center gap-2 p-4 text-center" role="status">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
        <p class="text-sm">Presentasi sedang dikonversi…</p>
        <p class="text-muted-foreground text-xs">Halaman ini terbuka otomatis setelah selesai.</p>
      </div>

      <div v-else-if="failed" class="flex size-full flex-col items-center justify-center gap-2 p-4 text-center" role="alert">
        <p class="text-destructive text-sm">Konversi gagal: {{ deck?.failureReason }}</p>
        <Button as-child variant="outline"><RouterLink to="/presentations">Kembali</RouterLink></Button>
      </div>

      <iframe
        v-else-if="embed"
        :src="embed"
        :title="deck?.title"
        class="size-full border-0"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        referrerpolicy="no-referrer"
        allow="fullscreen"
        allowfullscreen
      />

      <template v-else-if="pdf">
        <PdfPagedView :ref="(el: unknown) => (stage = el as Stage | null)" v-model:page="page" :pdf="pdf" :num-pages="numPages" :aspect="aspect" unit="Slide" :transition="transition" label="Penampil presentasi" />
        <p v-if="presenting" class="pointer-events-none absolute right-3 bottom-3 rounded bg-black/50 px-2 py-0.5 text-xs text-white/80 tabular-nums" aria-hidden="true">{{ page }} / {{ numPages }}</p>
      </template>
    </main>

    <footer v-if="pdf && !presenting" class="bg-background flex h-12 shrink-0 items-center gap-2 border-t px-2">
      <Button variant="ghost" size="icon" :disabled="page <= 1" aria-label="Slide sebelumnya" @click="stage?.prev()"><ChevronLeft class="size-4" /></Button>
      <input class="accent-primary min-w-0 flex-1" type="range" min="1" :max="numPages" :value="page" aria-label="Pindah ke slide" @input="setPage(Number(($event.target as HTMLInputElement).value))" />
      <span class="text-muted-foreground w-16 text-center text-xs tabular-nums">{{ page }} / {{ numPages }}</span>
      <Button variant="ghost" size="icon" :disabled="page >= numPages" aria-label="Slide berikutnya" @click="stage?.next()"><ChevronRight class="size-4" /></Button>
    </footer>
  </div>
</template>
