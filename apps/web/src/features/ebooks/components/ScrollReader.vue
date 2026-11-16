<script setup lang="ts">
import type { PDFDocumentProxy } from "pdfjs-dist";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { clearCanvas, type PageRender, renderPage } from "@/services/pdfService";

interface Props {
  pdf: PDFDocumentProxy;
  numPages: number;
  aspect: number;
  rtl: boolean; // not used by continuous scrolling; kept so all readers share one props shape
}
const props = defineProps<Props>();
const page = defineModel<number>("page", { required: true });

const scroller = ref<HTMLElement | null>(null);
const renders = new Map<number, PageRender>();
const drawn = new Set<number>();
let near: IntersectionObserver | null = null;
let far: IntersectionObserver | null = null;
let settling = 0; // ignore scroll events caused by our own scrollTo

const pageEl = (n: number) => scroller.value?.querySelector<HTMLElement>(`[data-page="${n}"]`) ?? null;
const canvasOf = (el: Element) => el.querySelector("canvas") as HTMLCanvasElement;

function draw(el: HTMLElement) {
  const n = Number(el.dataset.page);
  if (drawn.has(n)) return;
  drawn.add(n);
  const r = renderPage(props.pdf, n, canvasOf(el), el.clientWidth || 800);
  renders.set(n, r);
  r.done.catch(() => drawn.delete(n));
}

function free(el: HTMLElement) {
  const n = Number(el.dataset.page);
  renders.get(n)?.cancel();
  renders.delete(n);
  clearCanvas(canvasOf(el));
  drawn.delete(n);
}

/** Which page is at the reading line (a third of the way down the viewport)? */
function currentFromScroll(): number {
  const s = scroller.value;
  const first = pageEl(1);
  if (!s || !first) return 1;
  const second = pageEl(2);
  const stride = second ? second.offsetTop - first.offsetTop : first.offsetHeight;
  return Math.min(props.numPages, Math.max(1, Math.floor((s.scrollTop + s.clientHeight / 3 - first.offsetTop) / stride) + 1));
}

let raf = 0;
function onScroll() {
  if (performance.now() < settling) return;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const p = currentFromScroll();
    if (p !== page.value) page.value = p;
  });
}

function scrollToPage(n: number, smooth = false) {
  const el = pageEl(n);
  if (!el || !scroller.value) return;
  settling = performance.now() + 250;
  scroller.value.scrollTo({ top: el.offsetTop - 8, behavior: smooth ? "smooth" : "auto" });
}

/** Called by the toolbar slider / deep links. */
function goTo(p: number) {
  if (p !== currentFromScroll()) scrollToPage(p);
}
const step = (dir: 1 | -1) => scrollToPage(Math.min(props.numPages, Math.max(1, currentFromScroll() + dir)), true);
const next = () => step(1);
const prev = () => step(-1);

defineExpose({ next, prev, goTo });

onMounted(async () => {
  await nextTick();
  const root = scroller.value;
  if (!root) return;
  // render pages within one screen of the viewport; release the ones more than three screens away
  near = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && draw(e.target as HTMLElement)), { root, rootMargin: "100% 0px" });
  far = new IntersectionObserver((entries) => entries.forEach((e) => !e.isIntersecting && drawn.has(Number((e.target as HTMLElement).dataset.page)) && free(e.target as HTMLElement)), { root, rootMargin: "300% 0px" });
  root.querySelectorAll("[data-page]").forEach((el) => {
    near?.observe(el);
    far?.observe(el);
  });
  scrollToPage(page.value);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  near?.disconnect();
  far?.disconnect();
  renders.forEach((r) => r.cancel());
});
</script>

<template>
  <div ref="scroller" class="size-full overflow-y-auto overscroll-contain" tabindex="0" aria-label="Pembaca e-book mode gulir" @scroll.passive="onScroll">
    <div class="mx-auto flex w-full max-w-[900px] flex-col gap-2 p-2">
      <div v-for="n in numPages" :key="n" :data-page="n" class="bg-white shadow-xs" :style="{ aspectRatio: `1 / ${aspect}` }">
        <canvas class="size-full object-contain" :aria-label="`Halaman ${n}`" role="img" />
      </div>
    </div>
  </div>
</template>
