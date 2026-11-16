<script setup lang="ts">
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PageFlip } from "page-flip/dist/js/page-flip.module.js";
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { clearCanvas, type PageRender, renderPage } from "@/services/pdfService";

interface Props {
  pdf: PDFDocumentProxy;
  numPages: number;
  aspect: number;
  /** Right-to-left (manga): the page list is reversed, so turning right reveals earlier pages. */
  rtl: boolean;
}
const props = defineProps<Props>();
const page = defineModel<number>("page", { required: true });

const host = ref<HTMLElement | null>(null);

let flip: PageFlip | null = null;
let canvases: (HTMLCanvasElement | null)[] = [];
/** Page numbers in book order; `null` is an invisible placeholder (keeps the cover alone beside an empty half). */
let items: (number | null)[] = [];
let landscape = false;
const renders = new Map<number, PageRender>();
const drawn = new Set<number>();

const RENDER_WIDTH = 700; // CSS px; pdfService scales up for HiDPI
const NEAR = 3; // render this many pages around the current one
const KEEP = 7; // free canvases further away than this

/**
 * Every page is a normal ("soft") page, so turning the cover curls like any other page. (StPageFlip's `showCover`
 * makes covers "hard": they swing like a door, which looks broken on narrow screens and overflows on wide ones.)
 * Two-page spreads therefore add placeholders so the cover stands alone:
 *   LTR  [_ 1] [2 3] [4 5] ...      RTL  ... [5 4] [3 2] [1 _]
 * Single-page (portrait) layouts need none. RTL reverses the list, so turning right reveals earlier pages.
 */
function makeItems(twoPage: boolean): (number | null)[] {
  const pages = Array.from({ length: props.numPages }, (_, k) => k + 1);
  if (!twoPage) return props.rtl ? pages.reverse() : pages;
  if (!props.rtl) {
    const list: (number | null)[] = [null, ...pages];
    if (list.length % 2) list.push(null);
    return list;
  }
  const list: (number | null)[] = [...pages.reverse(), null];
  if (list.length % 2) list.unshift(null);
  return list;
}

const toIndex = (p: number) => Math.max(0, items.indexOf(p));
/** The page a given list index stands for (a placeholder stands for its real neighbour). */
const toPage = (i: number) => (landscape && props.rtl ? (items[i + 1] ?? items[i]) : items[i] ?? items[i + 1]) ?? items[i - 1] ?? 1; // RTL reads the right-hand page first
// in two-page layouts the list is even-aligned, so a spread starts at the even index
const spreadStart = (i: number) => (landscape ? i - (i % 2) : i);

function draw(index: number) {
  const canvas = canvases[index];
  const pageNumber = items[index];
  if (!canvas || pageNumber == null || drawn.has(index)) return;
  drawn.add(index);
  const r = renderPage(props.pdf, pageNumber, canvas, RENDER_WIDTH);
  renders.set(index, r);
  r.done.catch(() => drawn.delete(index)); // failed render: allow a retry on the next turn
}

function free(index: number) {
  renders.get(index)?.cancel();
  renders.delete(index);
  const canvas = canvases[index];
  if (canvas) clearCanvas(canvas);
  drawn.delete(index);
}

function refresh(center: number) {
  for (let i = Math.max(0, center - NEAR); i <= Math.min(items.length - 1, center + NEAR); i++) draw(i);
  for (const i of [...drawn]) if (Math.abs(i - center) > KEEP) free(i);
}

function teardown() {
  for (const i of [...drawn]) free(i);
  flip?.destroy();
  flip = null;
  canvases = [];
  host.value?.replaceChildren();
}

/** Creates the book for the given layout; if StPageFlip picks the other orientation, rebuilds once to match it. */
function build(twoPage = false, retried = false) {
  const el = host.value;
  if (!el) return;
  const keep = page.value; // survives rebuilds
  teardown();
  landscape = twoPage;
  items = makeItems(twoPage);

  const root = document.createElement("div");
  root.className = "size-full";
  el.append(root);

  const pages = items.map((n) => {
    const d = document.createElement("div");
    d.className = "page";
    if (n == null) {
      d.style.background = "transparent"; // empty half of the book
      d.style.pointerEvents = "none";
      canvases.push(null);
    } else {
      d.className += " bg-white";
      const c = document.createElement("canvas");
      c.className = "size-full bg-white object-contain";
      d.append(c);
      canvases.push(c);
    }
    return d;
  });

  const base = 450;
  const instance = new PageFlip(root, {
    width: base,
    height: Math.round(base * props.aspect),
    size: "stretch",
    minWidth: 200,
    maxWidth: 1100,
    minHeight: Math.round(200 * props.aspect),
    maxHeight: Math.round(1100 * props.aspect),
    showCover: false, // see makeItems
    usePortrait: true, // single page on narrow screens
    mobileScrollSupport: false,
    drawShadow: true,
    maxShadowOpacity: 0.4,
    flippingTime: 650,
    autoSize: true,
    startPage: spreadStart(toIndex(keep)),
  });
  flip = instance;
  instance.loadFromHTML(pages);

  const actuallyLandscape = instance.getOrientation() === "landscape";
  if (actuallyLandscape !== twoPage && !retried) return build(actuallyLandscape, true);

  instance.on("flip", (e) => {
    const index = Number(e.data);
    // a spread is named by its left page; keep the current page if it is on screen (e.g. after jumping to the last page)
    const onScreen = landscape ? [items[index], items[index + 1]] : [items[index]];
    if (!onScreen.includes(page.value)) page.value = toPage(index);
    refresh(index);
  });
  // rotating the device / resizing across the breakpoint switches between one and two pages
  instance.on("changeOrientation", (e) => {
    if ((e.data === "landscape") !== landscape) queueMicrotask(() => build(e.data === "landscape", true));
  });
  refresh(toIndex(keep));
}

/** Called by the toolbar slider / deep links: turn to `p` unless it is already on screen. */
function goTo(p: number) {
  if (!flip) return;
  const target = toIndex(p);
  const current = flip.getCurrentPageIndex();
  if (spreadStart(target) !== spreadStart(current)) flip.flip(spreadStart(target));
}

const next = () => (props.rtl ? flip?.flipPrev() : flip?.flipNext());
const prev = () => (props.rtl ? flip?.flipNext() : flip?.flipPrev());

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // the page slider uses the arrows
  if (e.key === "ArrowRight") flip?.flipNext(); // visual direction: right always reveals the next list index
  else if (e.key === "ArrowLeft") flip?.flipPrev();
  else if (e.key === "PageDown" || e.key === " ") next();
  else if (e.key === "PageUp") prev();
  else return;
  e.preventDefault();
}

defineExpose({ next, prev, goTo });

onMounted(async () => {
  await nextTick(); // the host needs its layout size before StPageFlip measures it
  build();
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  teardown();
});
</script>

<template>
  <div ref="host" class="size-full" role="document" aria-label="Pembaca e-book mode buku" />
</template>
