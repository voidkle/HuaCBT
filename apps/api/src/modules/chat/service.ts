import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileTypeFromBuffer } from "file-type";
import { cleanName } from "../../http/fileName";
import { and, desc, eq, ilike, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "../../db";
import { type ChatAttachmentKind, chatMembers, chatMessages, chatRooms, ebooks, presentations, type Role, users, videos } from "../../db/schema";
import { uploadDir } from "../../storage";
import { getSettings } from "../config/service";
import { checkSlideLink, linkablePresentations } from "../presentations/service";
import { checkVideoLink, linkableVideos } from "../videos/service";
import { publishToUsers } from "./realtime";

export interface Viewer {
  id: number;
  role: Role;
}

type Failure = { ok: false; code: 403 | 404 | 413 | 422; message: string };
export type Result<T> = { ok: true; value: T } | Failure;
const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const MB = 1024 * 1024;

// ---------------------------------------------------------------- attachments

const chatDir = join(uploadDir, "chat");
export const attachmentFile = (messageId: number) => Bun.file(join(chatDir, String(messageId)));

/** Only formats browsers can show natively are served inline; everything else is a forced download. */
const INLINE_KINDS: Record<string, ChatAttachmentKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/vnd.wave": "audio",
  "audio/webm": "audio",
};


// ---------------------------------------------------------------- shaping

const userColumns = { senderId: chatMessages.senderId, senderName: users.name, senderRole: users.role };

const selectMessages = () =>
  db
    .select({
      id: chatMessages.id,
      roomId: chatMessages.roomId,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      deletedAt: chatMessages.deletedAt,
      attachmentKind: chatMessages.attachmentKind,
      attachmentName: chatMessages.attachmentName,
      attachmentMime: chatMessages.attachmentMime,
      attachmentSize: chatMessages.attachmentSize,
      linkType: chatMessages.linkType,
      linkRef: chatMessages.linkRef,
      linkPage: chatMessages.linkPage,
      ...userColumns,
      bookTitle: ebooks.title,
      bookPages: ebooks.pageCount,
      bookCover: ebooks.coverMime,
      videoTitle: videos.title,
      videoDuration: videos.durationSec,
      videoPoster: videos.hasPoster,
      videoOk: sql<boolean>`${videos.status} = 'ready' and ${videos.approval} = 'approved'`,
      slideTitle: presentations.title,
      slidePages: presentations.pageCount,
      slideCover: presentations.hasCover,
      slideOk: sql<boolean>`${presentations.status} = 'ready'`,
    })
    .from(chatMessages)
    .leftJoin(users, eq(chatMessages.senderId, users.id))
    .leftJoin(ebooks, and(eq(chatMessages.linkType, "ebook"), eq(chatMessages.linkRef, ebooks.id)))
    .leftJoin(videos, and(eq(chatMessages.linkType, "video"), eq(chatMessages.linkRef, videos.id)))
    .leftJoin(presentations, and(eq(chatMessages.linkType, "slide"), eq(chatMessages.linkRef, presentations.id)));

type MessageRow = Awaited<ReturnType<typeof selectMessages>>[number];

/**
 * One shape for every resource type: `page` is the position (page number, slide number, or seconds for video), `total` how far it can go
 * (page count / duration), `hasCover` whether a cover/poster exists. A target that was deleted (or, for videos, unpublished)
 * stays as a greyed `available: false` card.
 */
function shapeLink(r: MessageRow) {
  const base = { type: r.linkType as "ebook" | "video" | "slide", ref: r.linkRef!, page: r.linkPage ?? 0 };
  if (r.linkType === "video") return { ...base, title: r.videoTitle, total: r.videoDuration === null ? null : Math.floor(r.videoDuration), hasCover: r.videoPoster === true, available: r.videoTitle !== null && r.videoOk === true };
  if (r.linkType === "slide") return { ...base, page: r.linkPage ?? 1, title: r.slideTitle, total: r.slidePages, hasCover: r.slideCover === true, available: r.slideTitle !== null && r.slideOk === true };
  return { ...base, page: r.linkPage ?? 1, title: r.bookTitle, total: r.bookPages, hasCover: r.bookCover !== null, available: r.bookTitle !== null };
}

export function shapeMessage(r: MessageRow) {
  const deleted = r.deletedAt !== null;
  return {
    id: r.id,
    roomId: r.roomId,
    sender: r.senderId ? { id: r.senderId, name: r.senderName ?? "", role: r.senderRole! } : null,
    body: deleted ? "" : r.body,
    createdAt: r.createdAt,
    deleted,
    attachment: !deleted && r.attachmentKind ? { kind: r.attachmentKind, name: r.attachmentName ?? "berkas", mime: r.attachmentMime ?? "", size: r.attachmentSize ?? 0, url: `/chat/messages/${r.id}/file` } : null,
    link: !deleted && r.linkType ? shapeLink(r) : null,
  };
}
export type MessageView = ReturnType<typeof shapeMessage>;

// ---------------------------------------------------------------- membership

export async function memberIds(roomId: number): Promise<number[]> {
  return (await db.select({ id: chatMembers.userId }).from(chatMembers).where(eq(chatMembers.roomId, roomId))).map((r) => r.id);
}

async function isMember(roomId: number, userId: number): Promise<boolean> {
  const [row] = await db.select({ id: chatMembers.userId }).from(chatMembers).where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)));
  return row !== undefined;
}

// ---------------------------------------------------------------- rooms

const previewOf = (m: { body: string; deletedAt: Date | null; attachmentKind: ChatAttachmentKind | null; attachmentName: string | null; linkType: string | null }) => {
  if (m.deletedAt) return "Pesan dihapus";
  if (m.body.trim()) return m.body.trim().slice(0, 100);
  if (m.attachmentKind === "image") return "Gambar";
  if (m.attachmentKind === "video") return "Video";
  if (m.attachmentKind === "audio") return "Audio";
  if (m.attachmentKind === "file") return `Berkas: ${m.attachmentName ?? ""}`;
  return m.linkType === "video" ? "Tautan video" : m.linkType === "slide" ? "Tautan presentasi" : m.linkType ? "Tautan e-book" : "";
};

/** The viewer's rooms (or just one), newest activity first, with members, last message and unread count. */
export async function listRooms(viewerId: number, onlyRoomId?: number) {
  const mine = await db
    .select({ room: chatRooms })
    .from(chatMembers)
    .innerJoin(chatRooms, eq(chatMembers.roomId, chatRooms.id))
    .where(and(eq(chatMembers.userId, viewerId), onlyRoomId ? eq(chatRooms.id, onlyRoomId) : undefined))
    .orderBy(sql`${chatRooms.lastMessageAt} desc nulls last`, desc(chatRooms.id));
  if (mine.length === 0) return [];
  const ids = mine.map((r) => r.room.id);

  const members = await db
    .select({ roomId: chatMembers.roomId, id: users.id, name: users.name, role: users.role })
    .from(chatMembers)
    .innerJoin(users, eq(chatMembers.userId, users.id))
    .where(inArray(chatMembers.roomId, ids));

  const lastIds = db.select({ id: sql<number>`max(${chatMessages.id})` }).from(chatMessages).where(inArray(chatMessages.roomId, ids)).groupBy(chatMessages.roomId);
  const last = await db
    .select({ id: chatMessages.id, roomId: chatMessages.roomId, senderId: chatMessages.senderId, body: chatMessages.body, deletedAt: chatMessages.deletedAt, attachmentKind: chatMessages.attachmentKind, attachmentName: chatMessages.attachmentName, linkType: chatMessages.linkType, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(inArray(chatMessages.id, lastIds));

  const unread = await db
    .select({ roomId: chatMessages.roomId, n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .innerJoin(chatMembers, and(eq(chatMembers.roomId, chatMessages.roomId), eq(chatMembers.userId, viewerId)))
    .where(and(inArray(chatMessages.roomId, ids), isNull(chatMessages.deletedAt), sql`${chatMessages.senderId} is distinct from ${viewerId}`, sql`${chatMessages.id} > coalesce(${chatMembers.lastReadMessageId}, 0)`))
    .groupBy(chatMessages.roomId);

  return mine.map(({ room }) => {
    const lm = last.find((m) => m.roomId === room.id);
    return {
      id: room.id,
      type: room.type,
      name: room.name,
      members: members.filter((m) => m.roomId === room.id).map(({ id, name, role }) => ({ id, name, role })),
      lastMessage: lm ? { id: lm.id, senderId: lm.senderId, preview: previewOf(lm), createdAt: lm.createdAt } : null,
      lastMessageAt: room.lastMessageAt,
      unread: unread.find((u) => u.roomId === room.id)?.n ?? 0,
    };
  });
}
export type RoomView = Awaited<ReturnType<typeof listRooms>>[number];

async function userExists(id: number) {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  return u !== undefined;
}

export async function openDirectRoom(v: Viewer, otherId: number): Promise<Result<RoomView>> {
  if (otherId === v.id) return fail(422, "Tidak bisa memulai chat dengan diri sendiri");
  if (!(await userExists(otherId))) return fail(404, "Pengguna tidak ditemukan");
  const directKey = `${Math.min(v.id, otherId)}:${Math.max(v.id, otherId)}`;
  const [existing] = await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.directKey, directKey));
  if (existing) return ok((await listRooms(v.id, existing.id))[0]!);

  const roomId = await db.transaction(async (tx) => {
    const [room] = await tx.insert(chatRooms).values({ type: "direct", directKey, createdBy: v.id }).onConflictDoNothing().returning({ id: chatRooms.id });
    if (!room) return null; // lost a race with the other person: the room exists now
    await tx.insert(chatMembers).values([{ roomId: room.id, userId: v.id }, { roomId: room.id, userId: otherId }]);
    return room.id;
  });
  const id = roomId ?? (await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.directKey, directKey)))[0]!.id;
  const view = (await listRooms(v.id, id))[0]!;
  if (roomId) publishToUsers([v.id, otherId], { t: "room", room: view });
  return ok(view);
}

export async function createGroup(v: Viewer, name: string, memberIdList: number[]): Promise<Result<RoomView>> {
  const others = [...new Set(memberIdList)].filter((id) => id !== v.id);
  if (others.length === 0) return fail(422, "Pilih minimal satu anggota");
  const found = await db.select({ id: users.id }).from(users).where(inArray(users.id, others));
  if (found.length !== others.length) return fail(422, "Ada anggota yang tidak ditemukan");

  const [room] = await db.insert(chatRooms).values({ type: "group", name: name.trim(), createdBy: v.id }).returning({ id: chatRooms.id });
  const all = [v.id, ...others];
  await db.insert(chatMembers).values(all.map((userId) => ({ roomId: room!.id, userId })));
  const view = (await listRooms(v.id, room!.id))[0]!;
  publishToUsers(all, { t: "room", room: view });
  return ok(view);
}

export async function markRead(v: Viewer, roomId: number): Promise<Result<true>> {
  if (!(await isMember(roomId, v.id))) return fail(404, "Chat tidak ditemukan");
  await db
    .update(chatMembers)
    .set({ lastReadMessageId: sql`(select max(${chatMessages.id}) from ${chatMessages} where ${chatMessages.roomId} = ${roomId})` })
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, v.id)));
  return ok(true);
}

// ---------------------------------------------------------------- messages

export async function listMessages(v: Viewer, roomId: number, opts: { before?: number; limit: number }): Promise<Result<{ messages: MessageView[]; hasMore: boolean }>> {
  if (!(await isMember(roomId, v.id))) return fail(404, "Chat tidak ditemukan");
  const rows = await selectMessages()
    .where(and(eq(chatMessages.roomId, roomId), opts.before ? lt(chatMessages.id, opts.before) : undefined))
    .orderBy(desc(chatMessages.id))
    .limit(opts.limit + 1);
  const hasMore = rows.length > opts.limit;
  return ok({ messages: rows.slice(0, opts.limit).reverse().map(shapeMessage), hasMore });
}

export interface NewMessage {
  text: string;
  file?: File;
  link?: { type: "ebook" | "video" | "slide"; ref: number; page: number };
}

export async function sendMessage(v: Viewer, roomId: number, input: NewMessage): Promise<Result<MessageView>> {
  if (!(await isMember(roomId, v.id))) return fail(404, "Chat tidak ditemukan");
  const text = input.text.trim();
  if (!text && !input.file && !input.link) return fail(422, "Pesan kosong");

  let attachment: { kind: ChatAttachmentKind; mime: string; name: string; size: number } | undefined;
  if (input.file) {
    const { maxChatMediaMb } = await getSettings();
    if (input.file.size > maxChatMediaMb * MB) return fail(413, `Ukuran berkas maksimal ${maxChatMediaMb} MB`);
    if (input.file.size === 0) return fail(422, "Berkas kosong");
    const detected = await fileTypeFromBuffer(await input.file.slice(0, 4100).arrayBuffer()); // the bytes decide, not the declared type
    const mime = detected?.mime ?? "application/octet-stream";
    attachment = { kind: INLINE_KINDS[mime] ?? "file", mime, name: cleanName(input.file.name), size: input.file.size };
  }

  let link: NewMessage["link"];
  if (input.link?.type === "video") {
    const checked = await checkVideoLink(input.link.ref, input.link.page);
    if (!checked.ok) return fail(checked.code, checked.message);
    link = input.link;
  } else if (input.link?.type === "slide") {
    const checked = await checkSlideLink(input.link.ref, input.link.page);
    if (!checked.ok) return fail(checked.code, checked.message);
    link = input.link;
  } else if (input.link) {
    const [book] = await db.select({ pageCount: ebooks.pageCount }).from(ebooks).where(eq(ebooks.id, input.link.ref));
    if (!book) return fail(404, "E-book tidak ditemukan");
    if (input.link.page < 1 || input.link.page > book.pageCount) return fail(422, `Halaman harus antara 1 dan ${book.pageCount}`);
    link = input.link;
  }

  const [row] = await db
    .insert(chatMessages)
    .values({
      roomId,
      senderId: v.id,
      body: text,
      ...(attachment && { attachmentKind: attachment.kind, attachmentName: attachment.name, attachmentMime: attachment.mime, attachmentSize: attachment.size }),
      ...(link && { linkType: link.type, linkRef: link.ref, linkPage: link.page }),
    })
    .returning({ id: chatMessages.id });
  const id = row!.id;

  if (input.file) {
    try {
      await mkdir(chatDir, { recursive: true });
      await Bun.write(attachmentFile(id), input.file);
    } catch (e) {
      await db.delete(chatMessages).where(eq(chatMessages.id, id)); // no message without its file
      throw e;
    }
  }
  await db.update(chatRooms).set({ lastMessageAt: sql`now()` }).where(eq(chatRooms.id, roomId));

  const message = shapeMessage((await selectMessages().where(eq(chatMessages.id, id)))[0]!);
  publishToUsers(await memberIds(roomId), { t: "message", roomId, message });
  return ok(message);
}

/** The sender deletes their own message; admin and operator may delete any (moderation). */
export async function deleteMessage(v: Viewer, id: number): Promise<Result<true>> {
  const [msg] = await db.select({ roomId: chatMessages.roomId, senderId: chatMessages.senderId, hasFile: chatMessages.attachmentKind }).from(chatMessages).where(eq(chatMessages.id, id));
  if (!msg || !(await isMember(msg.roomId, v.id))) return fail(404, "Pesan tidak ditemukan");
  if (msg.senderId !== v.id && v.role !== "admin" && v.role !== "operator") return fail(403, "Hanya pengirim yang dapat menghapus pesan");
  await db.update(chatMessages).set({ deletedAt: sql`now()` }).where(eq(chatMessages.id, id));
  if (msg.hasFile) await rm(attachmentFile(id).name!, { force: true });
  publishToUsers(await memberIds(msg.roomId), { t: "deleted", roomId: msg.roomId, messageId: id });
  return ok(true);
}

/** Resolves a message's file for a member of its room. */
export async function messageFile(v: Viewer, id: number): Promise<Result<{ file: Bun.BunFile; kind: ChatAttachmentKind; mime: string; name: string }>> {
  const [msg] = await db
    .select({ roomId: chatMessages.roomId, kind: chatMessages.attachmentKind, mime: chatMessages.attachmentMime, name: chatMessages.attachmentName, deletedAt: chatMessages.deletedAt })
    .from(chatMessages)
    .where(eq(chatMessages.id, id));
  if (!msg || msg.deletedAt || !msg.kind || !(await isMember(msg.roomId, v.id))) return fail(404, "Berkas tidak ditemukan");
  const file = attachmentFile(id);
  if (!(await file.exists())) return fail(404, "Berkas tidak ditemukan");
  return ok({ file, kind: msg.kind, mime: msg.mime ?? "application/octet-stream", name: msg.name ?? "berkas" });
}

// ---------------------------------------------------------------- directories (people, linkable resources)

export async function searchUsers(viewerId: number, q: string, limit = 30) {
  const term = q.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(ne(users.id, viewerId), term ? ilike(users.name, `%${term}%`) : undefined))
    .orderBy(users.name)
    .limit(limit);
}

export async function linkables() {
  const books = await db
    .select({ id: ebooks.id, title: ebooks.title, pageCount: ebooks.pageCount, hasCover: sql<boolean>`${ebooks.coverMime} is not null` })
    .from(ebooks)
    .orderBy(desc(ebooks.createdAt))
    .limit(200);
  return { ebooks: books, presentations: await linkablePresentations(), videos: (await linkableVideos()).map((v) => ({ id: v.id, title: v.title, durationSec: Math.floor(v.durationSec ?? 0), hasPoster: v.hasPoster })) };
}
