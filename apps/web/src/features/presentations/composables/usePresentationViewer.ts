import type { PDFDocumentProxy } from "pdfjs-dist";
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { openPdf, pageAspect } from "@/services/pdfService";
import { fetchPresentation, fileUrl, saveProgress } from "../services/presentationApi";
import { type Presentation, type SlideTransition, TRANSITIONS } from "../types";

const TRANSITION_KEY = "hua-slide-transition";
const SAVE_DELAY_MS = 1500;
const POLL_MS = 2000;

/**
 * Loads a deck. File decks are opened with pdf.js once converted (polled while converting); links need nothing but their embed URL.
 * Start slide priority: `startPage` (a shared link) > the user's saved slide > 1.
 */
export function usePresentationViewer(id: number, startPage: number | null) {
  const deck = ref<Presentation | null>(null);
  const pdf = shallowRef<PDFDocumentProxy | null>(null); // never make pdf.js objects deeply reactive
  const numPages = ref(0);
  const aspect = ref(9 / 16);
  const page = ref(1);
  const loading = ref(true);
  const loadProgress = ref(0);
  const error = ref<string | null>(null);

  // transition between slides: remembered per browser (storage may be blocked: then it just is not remembered)
  const readTransition = (): SlideTransition => {
    try {
      const v = localStorage.getItem(TRANSITION_KEY);
      return TRANSITIONS.some((t) => t.value === v) ? (v as SlideTransition) : "slide";
    } catch {
      return "slide";
    }
  };
  const transition = ref<SlideTransition>(readTransition());
  const setTransition = (t: SlideTransition) => {
    transition.value = t;
    try {
      localStorage.setItem(TRANSITION_KEY, t);
    } catch {
      /* not remembered */
    }
  };

  const clamp = (n: number) => Math.min(Math.max(1, Math.round(n) || 1), Math.max(1, numPages.value));
  const setPage = (n: number) => (page.value = clamp(n));

  let poll: ReturnType<typeof setInterval> | undefined;

  async function open(meta: Presentation) {
    if (meta.kind !== "file" || meta.status !== "ready") return;
    const doc = markRaw(await openPdf(fileUrl(id), (f) => (loadProgress.value = f)));
    aspect.value = await pageAspect(doc);
    numPages.value = doc.numPages;
    pdf.value = doc;
    page.value = clamp(startPage ?? meta.progressPage ?? 1);
  }

  async function load() {
    loading.value = true;
    error.value = null;
    clearInterval(poll);
    try {
      deck.value = await fetchPresentation(id);
      if (deck.value.status === "converting") {
        // wait for the server-side conversion, then open the result
        poll = setInterval(async () => {
          try {
            const next = await fetchPresentation(id);
            deck.value = next;
            if (next.status === "converting") return;
            clearInterval(poll);
            await open(next);
          } catch (e) {
            clearInterval(poll);
            error.value = e instanceof Error ? e.message : "Presentasi tidak dapat dibuka";
          }
        }, POLL_MS);
      } else {
        await open(deck.value);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Presentasi tidak dapat dibuka";
    } finally {
      loading.value = false;
    }
  }

  // --- progress: debounced while moving, flushed when leaving (file decks only; a link has no slide count) ---
  let timer: ReturnType<typeof setTimeout> | undefined;
  let savedPage: number | null = null;
  async function flush() {
    clearTimeout(timer);
    if (!pdf.value || savedPage === page.value) return;
    savedPage = page.value;
    try {
      await saveProgress(id, page.value);
    } catch {
      savedPage = null;
    }
  }
  watch(page, () => {
    if (!pdf.value) return;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  });
  const onHidden = () => document.visibilityState === "hidden" && void flush();

  onMounted(() => {
    void load();
    document.addEventListener("visibilitychange", onHidden);
  });
  onBeforeUnmount(() => {
    clearInterval(poll);
    document.removeEventListener("visibilitychange", onHidden);
    void flush();
    void pdf.value?.loadingTask.destroy();
  });

  return { deck, pdf, numPages, aspect, page, loading, loadProgress, error, transition, setTransition, setPage, load };
}
