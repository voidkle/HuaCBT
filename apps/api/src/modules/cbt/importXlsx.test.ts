import { expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { buildTemplate, parseRows, readXlsx } from "./importXlsx";

/** Named-field row: type, question, points, options (A..), answer, explanation. */
const mk = (type: string, q: string, points: string | number = "", opts: string[] = [], answer = "", expl = "") =>
  [type, q, String(points), ...Array.from({ length: 8 }, (_, i) => opts[i] ?? ""), answer, expl];

test("template round-trips: 4 example questions, no errors", async () => {
  const r = await readXlsx(new Uint8Array(await buildTemplate()));
  expect(r.errors).toEqual([]);
  expect(r.questions.map((q) => q.type)).toEqual(["single", "multiple", "truefalse", "essay"]);
  expect(r.questions[0]!.options.map((o) => o.correct)).toEqual([false, true, false, false]);
  expect(r.questions[1]!.options.map((o) => o.correct)).toEqual([true, false, true, false]);
  expect(r.questions[2]!.options).toEqual([{ text: "Benar", correct: true }, { text: "Salah", correct: false }]);
  expect(r.questions[1]!.points).toBe(2);
});

test("parseRows: aliases, default points, blank lines skipped, Excel row numbers", () => {
  const r = parseRows([mk("pg", "Q1", "", ["a", "b"], "b"), mk("", ""), mk("Esai", "Q2", 3), mk("zzz", "Q3")]);
  expect(r.questions).toHaveLength(2);
  expect(r.questions[0]!.points).toBe(1);
  expect(r.questions[0]!.options).toEqual([{ text: "a", correct: false }, { text: "b", correct: true }]);
  expect(r.errors).toEqual([{ row: 5, message: expect.stringContaining("tidak dikenal") }]);
});

test("parseRows: each broken rule names its row", () => {
  const bad = (cells: string[]) => parseRows([cells]).errors[0]?.message ?? "";
  expect(bad(mk("PG", "", 1))).toContain("kosong");
  expect(bad(mk("PG", "Q", 0, ["a", "b"], "A"))).toContain("Poin");
  expect(bad(mk("PG", "Q", 1.5, ["a", "b"], "A"))).toContain("Poin");
  expect(bad(mk("PG", "Q", 1, ["a", "b"], "A,B"))).toContain("tepat satu");
  expect(bad(mk("PG", "Q", 1, ["a", "b"], "C"))).toContain("Pilihan C yang kosong");
  expect(bad(mk("PG", "Q", 1, ["a", "b"], "Z"))).toContain("tidak valid");
  expect(bad(mk("PG", "Q", 1, ["a"], "A"))).toContain("2 sampai 8");
  expect(bad(mk("PGK", "Q", 1, ["a", "b"], ""))).toContain("minimal satu");
  expect(bad(mk("BS", "Q", 1, [], "mungkin"))).toContain("Benar");
  expect(bad(mk("Esai", "Q", 1, ["a"]))).toContain("tidak memakai pilihan");
  expect(bad(mk("Esai", "x".repeat(5001)))).toContain("terlalu panjang");
  expect(bad(mk("Esai", "Q", 1, [], "", "x".repeat(2001)))).toContain("Pembahasan");
});

test("parseRows: an empty sheet is an error, not a silent no-op", () => {
  expect(parseRows([]).errors[0]!.message).toContain("Tidak ada pertanyaan");
});

test("readXlsx: rejects non-xlsx, truncated zips and oversized files with readable messages", async () => {
  await expect(readXlsx(new TextEncoder().encode("a,b\n1,2"))).rejects.toThrow("bukan .xlsx");
  await expect(readXlsx(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]))).rejects.toThrow("tidak bisa dibaca");
  await expect(readXlsx(new Uint8Array(2 * 1024 * 1024 + 1))).rejects.toThrow("terlalu besar");
});

test("readXlsx: formulas and rich text are read as their text; row cap enforced", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Soal");
  ws.addRow(["Tipe", "Pertanyaan"]);
  ws.addRow(["Esai", { richText: [{ text: "Halo " }, { text: "dunia" }] }, { formula: "1+1", result: 2 }]);
  const r = await readXlsx(new Uint8Array(await wb.xlsx.writeBuffer()));
  expect(r.questions[0]).toMatchObject({ text: "Halo dunia", points: 2 });

  const big = new ExcelJS.Workbook().addWorksheet("Soal");
  big.getCell("A600").value = "x";
  const wb2 = big.workbook;
  await expect(readXlsx(new Uint8Array(await wb2.xlsx.writeBuffer()))).rejects.toThrow("Maksimal 500");
});
