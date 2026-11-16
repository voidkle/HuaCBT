import type { PDFDocumentProxy } from "pdfjs-dist";
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { fetchEbook, fileUrl, saveProgress } from "../services/ebookApi";
import { openPdf, pageAspect } from "@/services/pdfService";
import { type Ebook, READER_MODES, type ReaderMode } from "../types";

const MODE_KEY = "hua-reader-mode";
const RTL_KEY = "hua-reader-rtl";
const SAVE_DELAY_MS = 1500;

const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the preference just isn't remembered */
  }
};

/**
 * Loads a book and owns the reading state (current page, mode, direction).
 * Start page priority: `startPage` (e.g. a shared link) > the user's saved page > 1.
 */
export function useEbookReader(ebookId: number, startPage: number | null) {
  const ebook = ref<Ebook | null>(null);
  const pdf = shallowRef<PDFDocumentProxy | null>(null); // never make pdf.js objects deeply reactive
  const numPages = ref(0);
  const aspect = ref(1.4);
  const loading = ref(true);
  const loadProgress = ref(0);
  const error = ref<string | null>(null);

  const storedMode = readStored(MODE_KEY);
  const mode = ref<ReaderMode>((READER_MODES as readonly string[]).includes(storedMode ?? "") ? (storedMode as ReaderMode) : "flip");
  const rtl = ref(readStored(RTL_KEY) === "1");
  const page = ref(1);

  const clamp = (n: number) => Math.min(Math.max(1, Math.round(n) || 1), Math.max(1, numPages.value));
  const setPage = (n: number) => {
    page.value = clamp(n);
  };
  const setMode = (m: ReaderMode) => {
    mode.value = m;
    writeStored(MODE_KEY, m);
  };
  const toggleRtl = () => {
    rtl.value = !rtl.value;
    writeStored(RTL_KEY, rtl.value ? "1" : "0");
  };

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const meta = await fetchEbook(ebookId);
      ebook.value = meta;
      const doc = markRaw(await openPdf(fileUrl(ebookId), (f) => (loadProgress.value = f)));
      aspect.value = await pageAspect(doc);
      numPages.value = doc.numPages;
      pdf.value = doc;
      page.value = clamp(startPage ?? meta.progressPage ?? 1);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "E-book tidak dapat dibuka";
    } finally {
      loading.value = false;
    }
  }

  // --- reading progress: debounced while turning pages, flushed when leaving ---
  let timer: ReturnType<typeof setTimeout> | undefined;
  let savedPage: number | null = null;
  async function flush() {
    clearTimeout(timer);
    if (!pdf.value || savedPage === page.value) return;
    savedPage = page.value;
    try {
      await saveProgress(ebookId, page.value);
    } catch {
      savedPage = null; // retry on the next change
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
    document.removeEventListener("visibilitychange", onHidden);
    void flush();
    void pdf.value?.loadingTask.destroy(); // aborts network requests and frees the worker
  });

  return { ebook, pdf, numPages, aspect, loading, loadProgress, error, mode, rtl, page, setPage, setMode, toggleRtl, load };
}
