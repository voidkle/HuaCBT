import { expect, test } from "bun:test";
import { parseSummary, ProviderError } from "./providers";

test("parseSummary reads JSON out of chatty / fenced model output", () => {
  const r = parseSummary('Tentu, ini hasilnya:\n```json\n{"summary":"  Ringkas.  ","chapters":[{"start":10,"title":"B"},{"start":0,"title":"A"}]}\n```\nSemoga membantu!', 100);
  expect(r).toEqual({ summary: "Ringkas.", chapters: [{ start: 0, title: "A" }, { start: 10, title: "B" }] });
});

test("chapters: invalid, out-of-range, duplicate and untitled entries are dropped; at most 20", () => {
  const chapters = [{ start: "x", title: "bad" }, { start: -1, title: "negatif" }, { start: 500, title: "lewat durasi" }, { start: 5, title: "" }, { start: 7.6, title: "pecahan" }, { start: 8, title: "duplikat" }, ...Array.from({ length: 30 }, (_, i) => ({ start: 10 + i, title: `bab ${i}` }))];
  const r = parseSummary(JSON.stringify({ summary: "ok", chapters }), 100);
  expect(r.chapters[0]).toEqual({ start: 8, title: "pecahan" }); // 7.6 rounds to 8; the later "duplikat" at the same second is dropped
  expect(r.chapters.length).toBe(20);
  expect(r.chapters.every((c) => c.start >= 0 && c.start <= 100)).toBe(true);
});

test("parseSummary rejects unusable answers with a readable error", () => {
  for (const bad of ["maaf, tidak bisa", "{broken json", '{"summary":"   "}', '{"chapters":[]}']) expect(() => parseSummary(bad, 100)).toThrow(ProviderError);
});

test("summary and titles are length-capped", () => {
  const r = parseSummary(JSON.stringify({ summary: "a".repeat(5000), chapters: [{ start: 1, title: "t".repeat(500) }] }), 100);
  expect(r.summary.length).toBe(3000);
  expect(r.chapters[0]!.title.length).toBe(100);
});

test("a missing chapters field gives an empty list", () => {
  expect(parseSummary('{"summary":"hanya ringkasan"}', 60).chapters).toEqual([]);
});
