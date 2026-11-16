import type { Role } from "@/features/auth/types";

export interface Person {
  id: number;
  name: string;
  username: string;
  role: Role;
}

export interface OpenSessionInfo {
  id: number;
  title: string;
  startedAt: Date;
  closesAt: Date | null;
}

export interface Classroom {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  memberCount: number;
  canManage: boolean;
  openSession: OpenSessionInfo | null;
}

/** `members` is filled for managers only. */
export interface ClassroomDetail extends Classroom {
  members: Person[];
}

export interface ClassroomInput {
  name: string;
  memberIds: number[];
}

export interface Attendance {
  checkedAt: Date;
  late: boolean;
}

export interface SessionSummary {
  id: number;
  classroomId: number;
  title: string;
  startedAt: Date;
  closesAt: Date | null;
  closedAt: Date | null;
  lateAfterMinutes: number | null;
  open: boolean;
  mine: Attendance | null;
  /** Managers only. */
  stats: { present: number; late: number; total: number } | null;
}

export interface SessionInput {
  title: string;
  durationMinutes?: number;
  lateAfterMinutes?: number;
}

export interface RosterEntry extends Person {
  checkedAt: Date | null;
  late: boolean | null;
  distanceM: number | null;
}

/** `roster` is filled for managers only. */
export interface SessionDetail extends Omit<SessionSummary, "stats"> {
  classroomName: string;
  roster: RosterEntry[] | null;
}

/** A session the signed-in user can check in to right now. */
export interface MySession extends Omit<SessionSummary, "stats"> {
  classroomName: string;
}

export interface Passkey {
  id: number;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface PresenceConfig {
  biometricsEnabled: boolean;
  locationRequired: boolean;
}
