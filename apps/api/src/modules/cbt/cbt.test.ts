import { expect, test } from "bun:test";
import { scoreChoice } from "./scoring";
import { mix, seededShuffle } from "./shuffle";

test("single / true-false are all or nothing", () => {
  expect(scoreChoice("single", [2], [2], 5)).toBe(5);
  expect(scoreChoice("single", [2], [3], 5)).toBe(0);
  expect(scoreChoice("single", [2], [], 5)).toBe(0);
  expect(scoreChoice("single", [2], [2, 3], 5)).toBe(0); // picking two is never right
  expect(scoreChoice("truefalse", [7], [7], 2)).toBe(2);
});

test("multiple-select: proportional credit, wrong picks subtract, floor at zero", () => {
  const correct = [1, 2, 3, 4];
  expect(scoreChoice("multiple", correct, [1, 2, 3, 4], 8)).toBe(8);
  expect(scoreChoice("multiple", correct, [1, 2], 8)).toBe(4); // half of the right ones
  expect(scoreChoice("multiple", correct, [1, 2, 9], 8)).toBe(2); // (2 right - 1 wrong) / 4
  expect(scoreChoice("multiple", correct, [9, 10], 8)).toBe(0); // never negative
  expect(scoreChoice("multiple", correct, [1, 2, 3, 4, 9], 8)).toBe(6); // (4 - 1) / 4
  expect(scoreChoice("multiple", [1, 2], [1, 2, 3, 4], 10)).toBe(0); // "select everything" earns nothing
  expect(scoreChoice("multiple", correct, [], 8)).toBe(0);
  expect(scoreChoice("multiple", [1, 2, 3], [1], 1)).toBe(0.33); // rounded to 2 decimals
  expect(scoreChoice("multiple", [], [1], 5)).toBe(0); // a question without correct options cannot score
});

test("shuffle is deterministic per seed, a permutation, and actually shuffles", () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const a = seededShuffle(items, 12345);
  expect(seededShuffle(items, 12345)).toEqual(a); // same seed -> same order (a refresh keeps the order)
  expect([...a].sort((x, y) => x - y)).toEqual(items); // nothing lost or duplicated
  expect(a).not.toEqual(items);
  expect(seededShuffle(items, 54321)).not.toEqual(a); // different attempt -> different order
  expect(items).toEqual(Array.from({ length: 20 }, (_, i) => i)); // input not mutated
  expect(seededShuffle([], 1)).toEqual([]);
  expect(seededShuffle([9], 1)).toEqual([9]);
  expect(mix(7, 1)).not.toBe(mix(7, 2)); // per-question seeds differ
});

test("shuffle is roughly uniform (no position is heavily favoured)", () => {
  const counts = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (let seed = 1; seed <= 4000; seed++) seededShuffle([0, 1, 2, 3], seed).forEach((v, pos) => counts[v]![pos]++);
  for (const row of counts) for (const c of row) expect(c).toBeGreaterThan(800); // expected 1000 each
});
