/** A lesson as the clash rules see it. `teacherId` is already resolved (assignment teacher, else homeroom teacher). */
export interface Slot {
  id: number;
  classroomId: number;
  teacherId: number | null;
  roomId: number | null;
  weekday: number;
  startMin: number;
  endMin: number;
}

export type ClashKind = "class" | "teacher" | "room";

export const clashMessage: Record<ClashKind, string> = {
  class: "Kelas ini sudah punya pelajaran pada jam tersebut",
  teacher: "Guru sudah mengajar di kelas lain pada jam tersebut",
  room: "Ruang sudah dipakai kelas lain pada jam tersebut",
};

const overlaps = (a: Slot, b: Slot) => a.weekday === b.weekday && a.startMin < b.endMin && b.startMin < a.endMin;

/** Why two lessons cannot both happen, or null. Back-to-back (end == start) is fine. */
export function clash(a: Slot, b: Slot): ClashKind | null {
  if (a.id === b.id || !overlaps(a, b)) return null;
  if (a.classroomId === b.classroomId) return "class";
  if (a.teacherId !== null && a.teacherId === b.teacherId) return "teacher";
  if (a.roomId !== null && a.roomId === b.roomId) return "room";
  return null;
}

/** First clash between any candidate and any lesson in `others` (candidates' own ids are ignored there). */
export function firstClash(candidates: Slot[], others: Slot[]): ClashKind | null {
  const mine = new Set(candidates.map((c) => c.id));
  for (const c of candidates) for (const o of others) if (!mine.has(o.id)) {
    const k = clash(c, o);
    if (k) return k;
  }
  return null;
}
