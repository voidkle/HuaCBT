<script setup lang="ts">
import type { PDFDocumentProxy } from "pdfjs-dist";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { type PageRender, renderPage } from "@/services/pdfService";

interface Props {
  pdf: PDFDocumentProxy;
  numPages: number;
  aspect: number;
  /** Right-to-left (manga): tapping/swiping toward the left goes forward. */
  rtl?: boolean;
  /** Accessible name of the stage. */
  label?: string;
  /** What a page is called for screen readers ("Halaman", "Slide"). */
  unit?: string;
  /** How a page change is animated: the old page leaves while the new one enters. "none" (default) just swaps. */
  transition?: "none" | "fade" | "slide" | "zoom";
}
const props = withDefaults(defineProps<Props>(), { rtl: false, label: "Pembaca halaman", unit: "Halaman", transition: "none" });
const page = defineModel<number>("page", { required: true });

const stage = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const area = reactive({ w: 0, h: 0 });

/** The largest page-shaped box that fits the stage. */
const fit = computed(() => {
  const w = Math.floor(Math.min(area.w, area.h / props.aspect));
  return { width: Math.max(0, w), height: Math.max(0, Math.floor(w * props.aspect)) };
});

let observer: ResizeObserver | null = null;
let current: PageRender | null = null;
let token = 0;
let shown = 0; // the page currently on the visible canvas (0 = nothing drawn yet)
let leaving: HTMLCanvasElement[] = [];

const TRANSITION_MS = 320;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A frozen copy of the visible canvas, laid over it, so the old page can animate away while the new one animates in. */
function snapshot(source: HTMLCanvasElement): HTMLCanvasElement | null {
  if (!stage.value || source.width === 0) return null;
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")?.drawImage(source, 0, 0);
  Object.assign(copy.style, { position: "absolute", left: `${source.offsetLeft}px`, top: `${source.offsetTop}px`, width: `${source.offsetWidth}px`, height: `${source.offsetHeight}px`, pointerEvents: "none", background: "white" });
  stage.value.appendChild(copy);
  leaving.push(copy);
  return copy;
}

function playTransition(outgoing: HTMLCanvasElement, incoming: HTMLCanvasElement, dir: 1 | -1) {
  const frames = {
    fade: { out: [{ opacity: 1 }, { opacity: 0 }], in: [{ opacity: 0 }, { opacity: 1 }] },
    slide: { out: [{ transform: "translateX(0)" }, { transform: `translateX(${-dir * 100}%)` }], in: [{ transform: `translateX(${dir * 100}%)` }, { transform: "translateX(0)" }] },
    zoom: { out: [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.12)" }], in: [{ opacity: 0, transform: "scale(0.88)" }, { opacity: 1, transform: "scale(1)" }] },
  }[props.transition as "fade" | "slide" | "zoom"];
  const timing = { duration: TRANSITION_MS, easing: EASING, fill: "forwards" as const };
  const done = () => {
    outgoing.remove();
    leaving = leaving.filter((c) => c !== outgoing);
  };
  outgoing.animate(frames.out, timing).finished.then(done, done);
  incoming.animate(frames.in, { duration: TRANSITION_MS, easing: EASING });
}

async function draw() {
  const target = canvas.value;
  if (!target || fit.value.width < 10) return;
  const mine = ++token;
  current?.cancel();
  // draw off-screen, then copy: the visible page never goes blank while the next one renders
  const buffer = document.createElement("canvas");
  current = renderPage(props.pdf, page.value, buffer, fit.value.width);
  await current.done.catch(() => undefined);
  if (mine !== token) return;
  const changed = shown !== 0 && shown !== page.value; // a resize redraws the same page: no animation
  const dir = page.value > shown ? 1 : -1;
  leaving.forEach((c) => c.remove()); // a quick second turn ends the previous animation at once
  leaving = [];
  const outgoing = changed && props.transition !== "none" && !reducedMotion() ? snapshot(target) : null;
  target.width = buffer.width;
  target.height = buffer.height;
  target.getContext("2d")?.drawImage(buffer, 0, 0);
  shown = page.value;
  if (outgoing) playTransition(outgoing, target, dir);
}

const forward = () => {
  if (page.value < props.numPages) page.value++;
};
const back = () => {
  if (page.value > 1) page.value--;
};
// goTo is a no-op here: the page model drives the canvas through the watcher below
const goTo = () => undefined;
defineExpose({ next: forward, prev: back, goTo });

/** Visual tap zones: in RTL the left side is "forward". */
const leftAction = computed(() => (props.rtl ? forward : back));
const rightAction = computed(() => (props.rtl ? back : forward));

let startX = 0;
let startY = 0;
let swiped = false; // a swipe that starts and ends inside one tap zone must not also count as a tap
function onPointerDown(e: PointerEvent) {
  startX = e.clientX;
  startY = e.clientY;
}
function onPointerUp(e: PointerEvent) {
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return; // not a horizontal swipe
  swiped = true;
  setTimeout(() => (swiped = false), 350); // the click (if any) fires right after pointerup
  (dx < 0 ? rightAction : leftAction).value(); // swiping left shows what is on the right
}
const tap = (action: () => void) => () => {
  if (!swiped) action();
};

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === "ArrowRight") rightAction.value();
  else if (e.key === "ArrowLeft") leftAction.value();
  else if (e.key === "PageDown" || e.key === " ") forward();
  else if (e.key === "PageUp") back();
  else return;
  e.preventDefault();
}

watch([page, () => fit.value.width], draw);

onMounted(async () => {
  await nextTick();
  if (stage.value) {
    observer = new ResizeObserver(([entry]) => {
      area.w = entry!.contentRect.width;
      area.h = entry!.contentRect.height;
    });
    observer.observe(stage.value);
  }
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  leaving.forEach((c) => c.remove());
  observer?.disconnect();
  current?.cancel();
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div ref="stage" class="relative flex size-full items-center justify-center overflow-hidden select-none" :aria-label="label" @pointerdown="onPointerDown" @pointerup="onPointerUp">
    <canvas ref="canvas" class="bg-white shadow-sm" :style="{ width: `${fit.width}px`, height: `${fit.height}px` }" role="img" :aria-label="`${unit} ${page}`" />
    <button type="button" class="absolute inset-y-0 left-0 w-[30%] cursor-pointer" :aria-label="rtl ? `${unit} berikutnya` : `${unit} sebelumnya`" @click="tap(leftAction)()" />
    <button type="button" class="absolute inset-y-0 right-0 w-[30%] cursor-pointer" :aria-label="rtl ? `${unit} sebelumnya` : `${unit} berikutnya`" @click="tap(rightAction)()" />
  </div>
</template>
