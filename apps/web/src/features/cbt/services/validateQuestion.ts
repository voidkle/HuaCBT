import { MAX_OPTIONS, MIN_OPTIONS, type EditorQuestion } from "../types";

/** The same rules the API enforces, so the editor can explain problems before saving. Returns a message or null. */
export function validateQuestion(q: EditorQuestion): string | null {
  if (!q.text.trim()) return "Isi pertanyaan belum ditulis";
  if (!Number.isInteger(q.points) || q.points < 1) return "Poin minimal 1";
  if (q.type === "essay") return null;
  if (q.options.some((o) => !o.text.trim())) return "Ada pilihan jawaban yang kosong";
  const correct = q.options.filter((o) => o.correct).length;
  if (q.type === "truefalse") return correct === 1 ? null : "Pilih jawaban yang benar: Benar atau Salah";
  if (q.options.length < MIN_OPTIONS || q.options.length > MAX_OPTIONS) return `Butuh ${MIN_OPTIONS} sampai ${MAX_OPTIONS} pilihan jawaban`;
  if (q.type === "single") return correct === 1 ? null : "Pilih tepat satu jawaban yang benar";
  return correct >= 1 ? null : "Pilih minimal satu jawaban yang benar";
}

/** Changing a question's type reshapes its options sensibly instead of leaving an invalid mix. */
export function retype(q: EditorQuestion, type: EditorQuestion["type"]): EditorQuestion {
  if (type === q.type) return q;
  if (type === "essay") return { ...q, type, options: [] };
  if (type === "truefalse") return { ...q, type, options: [{ text: "Benar", correct: true }, { text: "Salah", correct: false }] };
  const fromChoice = q.type === "single" || q.type === "multiple";
  const options = fromChoice && q.options.length >= MIN_OPTIONS ? q.options : Array.from({ length: 4 }, (_, i) => ({ text: "", correct: i === 0 }));
  if (type === "single") {
    const first = options.findIndex((o) => o.correct);
    return { ...q, type, options: options.map((o, i) => ({ ...o, correct: i === (first === -1 ? 0 : first) })) }; // keep only one right answer
  }
  return { ...q, type, options };
}

export const blankQuestion = (): EditorQuestion => ({
  key: crypto.randomUUID(),
  type: "single",
  text: "",
  explanation: "",
  points: 1,
  options: Array.from({ length: 4 }, (_, i) => ({ text: "", correct: i === 0 })),
});
