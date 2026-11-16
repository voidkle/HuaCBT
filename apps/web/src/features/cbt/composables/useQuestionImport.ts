import { ref } from "vue";
import * as cbtApi from "../services/cbtApi";
import type { ImportPreview } from "../types";

/** Uploads an .xlsx for parsing (nothing is saved) and keeps the result for the dialog. */
export function useQuestionImport() {
  const preview = ref<ImportPreview | null>(null);
  const fileName = ref("");
  const parsing = ref(false);
  const failure = ref<string | null>(null);

  async function parse(file: File) {
    parsing.value = true;
    failure.value = null;
    preview.value = null;
    fileName.value = file.name;
    try {
      preview.value = await cbtApi.previewImport(file);
    } catch (e) {
      failure.value = e instanceof Error ? e.message : "Berkas tidak bisa dibaca";
    } finally {
      parsing.value = false;
    }
  }

  function reset() {
    preview.value = null;
    failure.value = null;
    fileName.value = "";
  }

  return { preview, fileName, parsing, failure, parse, reset };
}
