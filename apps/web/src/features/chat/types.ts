import type { Role } from "@/features/auth/types";

export interface ChatUser {
  id: number;
  name: string;
  role: Role;
}

export interface LastMessage {
  id: number;
  senderId: number | null;
  preview: string;
  createdAt: string;
}

export interface Room {
  id: number;
  type: "direct" | "group";
  name: string | null;
  members: ChatUser[];
  lastMessage: LastMessage | null;
  lastMessageAt: string | null;
  unread: number;
}

export type AttachmentKind = "image" | "video" | "audio" | "file";

export interface Attachment {
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
  /** Path on the API; prefix with the API base URL for <img>/<video>/<a>. */
  url: string;
}

export type LinkType = "ebook" | "video" | "slide";

/** A Linker card: points at a resource and a position inside it. `page` is a page number for an e-book, seconds for a video, a slide number for a presentation. */
export interface LinkTarget {
  type: LinkType;
  ref: number;
  page: number;
}

export interface MessageLink extends LinkTarget {
  title: string | null;
  /** How far the position can go: page count (e-book), duration in seconds (video) or slide count (presentation; null for a Google Slides / Canva link). */
  total: number | null;
  /** Cover (e-book), poster (video) or first slide (presentation) exists. */
  hasCover: boolean;
  /** False once the target was deleted: the card stays but is greyed out. */
  available: boolean;
}

export interface Message {
  id: number;
  roomId: number;
  sender: ChatUser | null;
  body: string;
  createdAt: string;
  deleted: boolean;
  attachment: Attachment | null;
  link: MessageLink | null;
}

export interface SendInput {
  text: string;
  file?: File;
  link?: LinkTarget;
}

export interface LinkableEbook {
  id: number;
  title: string;
  pageCount: number;
  hasCover: boolean;
}

export interface LinkableVideo {
  id: number;
  title: string;
  durationSec: number;
  hasPoster: boolean;
}

export interface LinkablePresentation {
  id: number;
  title: string;
  /** Null for a Google Slides / Canva link: it has no slide count to pick from. */
  pageCount: number | null;
  hasCover: boolean;
  kind: "file" | "google" | "canva";
}

export interface Linkables {
  ebooks: LinkableEbook[];
  videos: LinkableVideo[];
  presentations: LinkablePresentation[];
}

/** Events pushed over the WebSocket. */
export type ServerEvent =
  | { t: "message"; roomId: number; message: Message }
  | { t: "deleted"; roomId: number; messageId: number }
  | { t: "room"; room: Room };

export const MESSAGE_MAX = 2000;
export const PAGE_SIZE = 50;
