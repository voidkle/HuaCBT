import ExcelJS from "exceljs";
import { validateQuestion, type QuestionInput } from "./exams";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;
const MAX_QUESTIONS = 200; // same cap as the editor/API body
const LETTERS = "ABCDEFGH";

export interface ImportError {
  row: number;
  message: string;
}
export interface ImportResult {
  questions: QuestionInput[];
  errors: ImportError[];
}

const TYPES: Record<string, QuestionInput["type"]> = {
  pg: "single", single: "single", "pilihan ganda": "single",
  pgk: "multiple", multiple: "multiple", "pilihan ganda kompleks": "multiple",
  bs: "truefalse", truefalse: "truefalse", "benar salah": "truefalse", "benar/salah": "truefalse",
  esai: "essay", essay: "essay", uraian: "essay",
};

/** Pure: header-less rows of cell texts (row 0 = Excel row 2) -> questions + per-row errors. */
export function parseRows(rows: string[][]): ImportResult {
  const questions: QuestionInput[] = [];
  const errors: ImportError[] = [];
  rows.forEach((cells, i) => {
    const row = i + 2; // Excel row number: the header is row 1
    const c = (n: number) => (cells[n] ?? "").trim();
    if (cells.every((x) => !x.trim())) return; // blank line
    const fail = (message: string) => void errors.push({ row, message });

    const type = TYPES[c(0).toLowerCase()];
    if (!type) return fail(`Tipe "${c(0)}" tidak dikenal. Pakai PG, PGK, BS, atau Esai`);
    const text = c(1);
    if (!text) return fail("Pertanyaan kosong");
    if (text.length > 5000) return fail("Pertanyaan terlalu panjang (maks 5000 karakter)");
    const points = c(2) === "" ? 1 : Number(c(2).replace(",", "."));
    if (!Number.isInteger(points) || points < 1 || points > 1000) return fail("Poin harus bilangan bulat 1 sampai 1000");
    const explanation = c(12);
    if (explanation.length > 2000) return fail("Pembahasan terlalu panjang (maks 2000 karakter)");
    const answer = c(11);

    let options: QuestionInput["options"] = [];
    if (type === "truefalse") {
      const a = answer.toLowerCase();
      const right = ["benar", "b", "true"].includes(a) ? 0 : ["salah", "s", "false"].includes(a) ? 1 : -1;
      if (right === -1) return fail('Jawaban Benar untuk BS harus "Benar" atau "Salah"');
      options = [{ text: "Benar", correct: right === 0 }, { text: "Salah", correct: right === 1 }];
    } else if (type === "essay") {
      if (cells.slice(3, 11).some((x) => x.trim())) return fail("Esai tidak memakai pilihan jawaban; kosongkan kolom Pilihan");
    } else {
      const picked = new Set(answer.toUpperCase().split(/[\s,;/&]+/).filter(Boolean));
      const bad = [...picked].filter((l) => l.length !== 1 || !LETTERS.includes(l));
      if (bad.length) return fail(`Jawaban Benar "${answer}" tidak valid; pakai huruf pilihan, misalnya A atau A,C`);
      for (let k = 0; k < 8; k++) {
        const t = c(3 + k);
        if (t.length > 500) return fail(`Pilihan ${LETTERS[k]} terlalu panjang (maks 500 karakter)`);
        if (t) options.push({ text: t, correct: picked.has(LETTERS[k]!) });
        else if (picked.has(LETTERS[k]!)) return fail(`Jawaban Benar menunjuk Pilihan ${LETTERS[k]} yang kosong`);
      }
    }

    const q: QuestionInput = { type, text, explanation, points, options };
    const problem = validateQuestion(q, 0);
    if (problem) return fail(problem.replace(/^Pertanyaan \d+: /, "").replace(/^./, (x) => x.toUpperCase()));
    questions.push(q);
  });
  if (questions.length > MAX_QUESTIONS) errors.push({ row: 0, message: `Maksimal ${MAX_QUESTIONS} pertanyaan per ujian (file berisi ${questions.length})` });
  if (!questions.length && !errors.length) errors.push({ row: 0, message: "Tidak ada pertanyaan di sheet pertama" });
  return { questions, errors };
}

const cellText = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue); // formula
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text); // hyperlink
    if (v instanceof Date) return v.toISOString();
    return "";
  }
  return String(v);
};

/** Reads the first sheet of an .xlsx. Throws a user-facing Error for anything that is not a usable workbook. */
export async function readXlsx(buf: Uint8Array): Promise<ImportResult> {
  if (buf.length > MAX_IMPORT_BYTES) throw new Error("Berkas terlalu besar (maks 2 MB)");
  if (!(buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 3 && buf[3] === 4)) throw new Error("Berkas bukan .xlsx yang valid (unduh templatnya)");
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  } catch {
    throw new Error("Berkas .xlsx tidak bisa dibaca (rusak atau bukan Excel)");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Berkas tidak punya sheet");
  if (ws.rowCount > MAX_IMPORT_ROWS + 1) throw new Error(`Maksimal ${MAX_IMPORT_ROWS} baris per impor`);
  const rows: string[][] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    rows.push(Array.from({ length: 13 }, (_, k) => cellText(row.getCell(k + 1).value)));
  }
  return parseRows(rows);
}

/** The downloadable template: a "Soal" sheet with one example per type, and a "Petunjuk" sheet. */
export async function buildTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Soal");
  ws.columns = [
    { header: "Tipe", width: 8 }, { header: "Pertanyaan", width: 48 }, { header: "Poin", width: 7 },
    ...[...LETTERS].map((l) => ({ header: `Pilihan ${l}`, width: 18 })),
    { header: "Jawaban Benar", width: 16 }, { header: "Pembahasan", width: 36 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.addRows([
    ["PG", "Ibu kota Indonesia adalah ...", 1, "Bandung", "Jakarta", "Surabaya", "Medan", "", "", "", "", "B", "Jakarta adalah ibu kota saat ini."],
    ["PGK", "Manakah bilangan prima?", 2, "2", "4", "5", "9", "", "", "", "", "A,C", ""],
    ["BS", "Matahari terbit dari timur.", 1, "", "", "", "", "", "", "", "", "Benar", ""],
    ["Esai", "Jelaskan proses fotosintesis.", 5, "", "", "", "", "", "", "", "", "", "Nilai dari ketepatan konsep."],
  ]);
  const help = wb.addWorksheet("Petunjuk");
  help.getColumn(1).width = 110;
  help.addRows([
    ["Isi sheet \"Soal\", satu pertanyaan per baris. Hapus 4 contoh di bawah judul kolom sebelum mengisi."],
    ["Tipe: PG = pilihan ganda (satu jawaban), PGK = pilihan ganda kompleks (lebih dari satu jawaban), BS = benar/salah, Esai = uraian (dinilai manual)."],
    ["Poin: bilangan bulat 1 sampai 1000; kosong dianggap 1."],
    ["Pilihan A sampai H: isi 2 sampai 8 pilihan untuk PG dan PGK. Kosongkan untuk BS dan Esai."],
    ["Jawaban Benar: huruf pilihan, misalnya B (PG) atau A,C (PGK). Untuk BS tulis Benar atau Salah. Kosongkan untuk Esai."],
    ["Pembahasan: opsional, tampil setelah ujian dinilai jika pengaturan ujian menampilkannya."],
    ["Batas: 2 MB, 500 baris, dan 200 pertanyaan per ujian. Hanya sheet pertama yang dibaca."],
  ]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
