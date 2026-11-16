import type { Role } from "@/features/auth/types";

export type NoticeStatus = "pending" | "approved" | "rejected";

export interface NoticeAuthor {
  id: number;
  name: string;
  role: Role;
}

export interface Notice {
  id: number;
  title: string;
  body: string;
  status: NoticeStatus;
  /** Why a reviewer rejected it (shown to the author). */
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  author: NoticeAuthor;
}

export interface NoticeInput {
  title: string;
  body: string;
}

/** What the signed-in user may do with a given notice (the API enforces the same rules). */
export interface NoticePermissions {
  edit: (n: Notice) => boolean;
  remove: (n: Notice) => boolean;
  approve: (n: Notice) => boolean;
  reject: (n: Notice) => boolean;
}

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;
export const NOTE_MAX = 300;
