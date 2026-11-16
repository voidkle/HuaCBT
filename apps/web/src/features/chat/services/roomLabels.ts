import { roleLabels } from "@/features/auth/types";
import type { Room } from "../types";

/** A direct chat is named after the other person; a group uses its own name. */
export function roomTitle(room: Room, myId: number | undefined): string {
  if (room.type === "group") return room.name ?? "Grup";
  return room.members.find((m) => m.id !== myId)?.name ?? "Chat";
}

export function roomSubtitle(room: Room, myId: number | undefined): string {
  if (room.type === "group") return `${room.members.length} anggota`;
  const other = room.members.find((m) => m.id !== myId);
  return other ? roleLabels[other.role] : "";
}
