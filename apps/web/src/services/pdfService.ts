import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");

let pdfjs: Promise<PdfJs> | null = null;

/** pdf.js is large: load it (and its worker) only when a PDF is opened or analyzed. */
export function loadPdfjs(): Promise<PdfJs> {
  pdfjs ??= (async () => {
    const [lib, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return pdfjs;
}

/** Opens a PDF served by the API (e-books, converted slide decks). The server answers Range requests, so only the needed bytes are fetched. */
export async function openPdf(url: string, onProgress?: (fraction: number) => void): Promise<PDFDocumentProxy> {
  const lib = await loadPdfjs();
  const task = lib.getDocument({ url, withCredentials: true });
  if (onProgress) task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => total && onProgress(Math.min(1, loaded / total));
  return task.promise;
}

/** Opens a file the user just picked (before upload). */
export async function openLocalPdf(file: File): Promise<PDFDocumentProxy> {
  const lib = await loadPdfjs();
  return lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** Height / width of page 1; the readers assume all pages share it (others are letterboxed). */
export async function pageAspect(pdf: PDFDocumentProxy): Promise<number> {
  const v = (await pdf.getPage(1)).getViewport({ scale: 1 });
  return v.height / v.width;
}

export interface PageRender {
  /** Resolves when drawn, or when cancelled. */
  done: Promise<void>;
  cancel: () => void;
}

const MAX_CANVAS_WIDTH = 1600; // keeps canvases (width x height x 4 bytes) from exhausting memory on big screens

/** Draws a page into `canvas` at roughly `cssWidth` CSS pixels (sharp on HiDPI screens). */
export function renderPage(pdf: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number): PageRender {
  let cancelled = false;
  let task: { promise: Promise<unknown>; cancel: () => void } | null = null;

  const done = (async () => {
    const page = await pdf.getPage(pageNumber);
    if (cancelled) return;
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min((cssWidth * dpr) / base.width, MAX_CANVAS_WIDTH / base.width);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) return;
    task = page.render({ canvasContext: context, viewport, canvas });
    try {
      await task.promise;
    } catch (e) {
      if ((e as { name?: string }).name !== "RenderingCancelledException") throw e;
    }
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      task?.cancel();
    },
  };
}

/** Releases a canvas' pixel memory. */
export function clearCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/** Page 1 as a JPEG, used as the book's cover. */
export async function renderCover(pdf: PDFDocumentProxy, cssWidth = 480): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderPage(pdf, 1, canvas, cssWidth).done;
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat sampul"))), "image/jpeg", 0.82));
}
