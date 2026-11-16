import type { QuestionType } from "../../db/schema";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Score of one auto-graded (non-essay) question.
 *  - single / truefalse: all or nothing.
 *  - multiple: proportional credit, wrong picks cancel right ones, never below zero:
 *      points * max(0, (right - wrong) / numberOfCorrectOptions)
 *    so picking everything scores 0 unless everything is correct.
 */
export function scoreChoice(type: Exclude<QuestionType, "essay">, correctIds: number[], selectedIds: number[], points: number): number {
  const selected = new Set(selectedIds);
  if (type !== "multiple") return selected.size === 1 && correctIds.length === 1 && selected.has(correctIds[0]!) ? points : 0;
  if (correctIds.length === 0) return 0;
  const right = correctIds.filter((id) => selected.has(id)).length;
  const wrong = selected.size - right;
  return round2(points * Math.max(0, (right - wrong) / correctIds.length));
}

export { round2 };
