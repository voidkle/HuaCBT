import { ref } from "vue";
import { fetchMaxEbookMb } from "../services/ebookApi";
import { openLocalPdf, renderCover } from "@/services/pdfService";
import type { EbookUploadInput } from "../types";

const MB = 1024 * 1024;

export interface AnalyzedPdf {
  file: File;
  pageCount: number;
  cover: File | undefined;
}

/** Validates a picked PDF and extracts what the server wants besides the file: page count and a cover image. */
export function useEbookUpload() {
  const analyzing = ref(false);
  const problem = ref<string | null>(null);
  const analyzed = ref<AnalyzedPdf | null>(null);

  function reset() {
    analyzing.value = false;
    problem.value = null;
    analyzed.value = null;
  }

  async function analyze(file: File): Promise<boolean> {
    reset();
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      problem.value = "Berkas harus berformat PDF";
      return false;
    }
    analyzing.value = true;
    try {
      // best effort: the server enforces the limit anyway, this just avoids uploading a huge file to be refused
      const maxMb = await fetchMaxEbookMb().catch(() => null);
      if (maxMb !== null && file.size > maxMb * MB) {
        problem.value = `Ukuran e-book maksimal ${maxMb} MB (berkas ini ${(file.size / MB).toFixed(1)} MB)`;
        return false;
      }
      const pdf = await openLocalPdf(file);
      try {
        const blob = await renderCover(pdf).catch(() => null);
        analyzed.value = { file, pageCount: pdf.numPages, cover: blob ? new File([blob], "cover.jpg", { type: "image/jpeg" }) : undefined };
      } finally {
        void pdf.loadingTask.destroy();
      }
      return true;
    } catch {
      problem.value = "PDF tidak dapat dibaca. Pastikan berkasnya tidak rusak atau terkunci.";
      return false;
    } finally {
      analyzing.value = false;
    }
  }

  function toInput(title: string, description: string): EbookUploadInput | null {
    const a = analyzed.value;
    return a ? { file: a.file, cover: a.cover, title: title.trim(), description: description.trim(), pageCount: a.pageCount } : null;
  }

  return { analyzing, problem, analyzed, analyze, reset, toInput };
}
