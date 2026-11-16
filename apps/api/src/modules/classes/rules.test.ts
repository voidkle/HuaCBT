import { expect, test } from "bun:test";
import { clash, firstClash, type Slot } from "./rules";

const s = (over: Partial<Slot>): Slot => ({ id: 1, classroomId: 1, teacherId: 10, roomId: null, weekday: 1, startMin: 420, endMin: 465, ...over });

test("overlap needed; back-to-back is fine", () => {
  expect(clash(s({}), s({ id: 2, classroomId: 2, teacherId: 10, startMin: 465, endMin: 510 }))).toBeNull();
  expect(clash(s({}), s({ id: 2, classroomId: 2, teacherId: 10, startMin: 460, endMin: 510 }))).toBe("teacher");
  expect(clash(s({}), s({ id: 2, classroomId: 2, teacherId: 10, weekday: 2 }))).toBeNull();
});

test("class, teacher and room clashes", () => {
  expect(clash(s({}), s({ id: 2, teacherId: 11 }))).toBe("class");
  expect(clash(s({ roomId: 5 }), s({ id: 2, classroomId: 2, teacherId: 11, roomId: 5 }))).toBe("room");
  expect(clash(s({ roomId: null }), s({ id: 2, classroomId: 2, teacherId: 11, roomId: null }))).toBeNull(); // both stay in their own rooms
  expect(clash(s({ teacherId: null }), s({ id: 2, classroomId: 2, teacherId: null }))).toBeNull(); // unassigned teachers never collide
});

test("firstClash ignores the candidates themselves", () => {
  const a = s({ id: 1 });
  expect(firstClash([a], [a])).toBeNull();
  expect(firstClash([a], [s({ id: 2, classroomId: 2 })])).toBe("teacher");
});
