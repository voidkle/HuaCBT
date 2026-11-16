<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
import { type Component, ref } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { useEbookReader } from "../composables/useEbookReader";
import type { ReaderMode } from "../types";
import FlipReader from "./FlipReader.vue";
import PagedReader from "@/components/PdfPagedView.vue";
import ReaderBottomBar from "./ReaderBottomBar.vue";
import ReaderTopBar from "./ReaderTopBar.vue";
import ScrollReader from "./ScrollReader.vue";

interface Props {
  ebookId: number;
  /** From a shared link (?page=N); overrides the saved reading position. */
  startPage: number | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{ share: [payload: { ebookId: number; title: string; page: number }] }>();

const { ebook, pdf, numPages, aspect, loading, loadProgress, error, mode, rtl, page, setPage, setMode, toggleRtl, load } = useEbookReader(props.ebookId, props.startPage);

interface ActiveReader {
  next: () => void;
  prev: () => void;
  goTo: (page: number) => void;
}
const readers: Record<ReaderMode, Component> = { flip: FlipReader, scroll: ScrollReader, page: PagedReader };
const active = ref<ActiveReader | null>(null);

// slider / deep link -> tell the active reader to move; the reader reports its own position back through v-model
function jump(p: number) {
  setPage(p);
  active.value?.goTo(page.value);
}
</script>

<template>
  <div class="bg-muted flex h-svh flex-col">
    <ReaderTopBar :title="ebook?.title ?? ''" :mode="mode" :rtl="rtl" :can-share="pdf !== null" @update:mode="setMode" @toggle-rtl="toggleRtl" @share="emit('share', { ebookId: props.ebookId, title: ebook?.title ?? '', page })" />

    <main class="relative min-h-0 flex-1 overflow-hidden">
      <div v-if="loading" class="flex size-full flex-col items-center justify-center gap-2" aria-busy="true">
        <Loader2 class="text-muted-foreground size-6 animate-spin" />
        <p class="text-muted-foreground text-xs">Memuat e-book{{ loadProgress > 0 ? ` ${Math.round(loadProgress * 100)}%` : "…" }}</p>
      </div>

      <div v-else-if="error || !pdf" class="flex size-full flex-col items-center justify-center gap-3 p-4 text-center" role="alert">
        <p class="text-destructive text-sm">{{ error ?? "E-book tidak tersedia." }}</p>
        <div class="flex gap-2">
          <Button variant="outline" @click="load">Coba lagi</Button>
          <Button as-child variant="outline"><RouterLink to="/ebooks">Kembali</RouterLink></Button>
        </div>
      </div>

      <component
        :is="readers[mode]"
        v-else
        :ref="(el: unknown) => (active = el as ActiveReader | null)"
        :key="`${mode}-${rtl}`"
        v-model:page="page"
        :pdf="pdf"
        :num-pages="numPages"
        :aspect="aspect"
        :rtl="rtl"
      />
    </main>

    <ReaderBottomBar v-if="pdf" :page="page" :num-pages="numPages" :rtl="rtl" @update:page="jump" @prev="active?.prev()" @next="active?.next()" />
  </div>
</template>
