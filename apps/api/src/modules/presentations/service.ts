import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { presentationProgress, presentations, type Role, users } from "../../db/schema";
import { enqueueConversion } from "./jobs";
import { parseSlideLink } from "./links";
import { deckDir } from "./paths";

export const UPLOADERS = ["admin", "operator", "teacher", "staff"] as const satisfies readonly Role[];
const ADMINS: readonly Role[] = ["admin", "operator"];

export interface Viewer {
  id: number;
  role: Role;
}

const columns = {
  id: presentations.id,
  title: presentations.title,
  description: presentations.description,
  kind: presentations.kind,
  link: presentations.link,
  status: presentations.status,
  failureReason: presentations.failureReason,
  sizeBytes: presentations.sizeBytes,
  pageCount: presentations.pageCount,
  hasCover: presentations.hasCover,
  createdAt: presentations.createdAt,
  uploaderId: presentations.uploadedBy,
  uploaderName: users.name,
  progressPage: presentationProgress.page,
};

const query = (v: Viewer) =>
  db
    .select(columns)
    .from(presentations)
    .leftJoin(users, eq(presentations.uploadedBy, users.id))
    .leftJoin(presentationProgress, sql`${presentationProgress.presentationId} = ${presentations.id} and ${presentationProgress.userId} = ${v.id}`);

/** A failed conversion is only interesting to whoever uploaded it (and admins). */
const visible = (v: Viewer) => (ADMINS.includes(v.role) ? undefined : or(ne(presentations.status, "failed"), eq(presentations.uploadedBy, v.id)));

type Row = Awaited<ReturnType<typeof query>>[number];
const shape = ({ uploaderId, uploaderName, link, ...p }: Row) => ({
  ...p,
  link,
  embedUrl: link ? (parseSlideLink(link)?.embed ?? null) : null, // re-derived from the stored link, never stored separately
  uploader: uploaderId ? { id: uploaderId, name: uploaderName ?? "" } : null,
});

export async function listPresentations(v: Viewer) {
  return (await query(v).where(visible(v)).orderBy(desc(presentations.createdAt))).map(shape);
}

export async function getPresentation(v: Viewer, id: number) {
  const [row] = await query(v).where(and(eq(presentations.id, id), visible(v)));
  return row ? shape(row) : null;
}

type Failure = { ok: false; code: 422; message: string };

export async function createFromLink(v: Viewer, input: { title: string; description: string; link: string }): Promise<{ ok: true; id: number } | Failure> {
  const parsed = parseSlideLink(input.link);
  if (!parsed) return { ok: false, code: 422, message: "Tautan harus berupa tautan bagikan Google Slides atau Canva (https). Tautan edit Canva tidak diterima: pakai tautan Lihat." };
  const [row] = await db.insert(presentations).values({ title: input.title, description: input.description, kind: parsed.kind, link: parsed.link, status: "ready", uploadedBy: v.id }).returning({ id: presentations.id });
  return { ok: true, id: row!.id };
}

/** Stores the original and queues the conversion; the row is "converting" until the job finishes. */
export async function createFromFile(v: Viewer, input: { title: string; description: string; file: File; ext: "pptx" | "ppt" | "odp" }): Promise<number> {
  const [row] = await db.insert(presentations).values({ title: input.title, description: input.description, kind: "file", status: "converting", sizeBytes: input.file.size, uploadedBy: v.id }).returning({ id: presentations.id });
  const id = row!.id;
  try {
    await mkdir(deckDir(id), { recursive: true });
    await Bun.write(join(deckDir(id), `source.${input.ext}`), input.file);
  } catch (e) {
    await rm(deckDir(id), { recursive: true, force: true });
    await db.delete(presentations).where(eq(presentations.id, id)); // no row without its file
    throw e;
  }
  enqueueConversion(id);
  return id;
}

/** Uploader may delete their own deck; admin/operator any. */
export async function deletePresentation(v: Viewer, id: number): Promise<"ok" | "notfound" | "forbidden"> {
  const [p] = await db.select({ uploadedBy: presentations.uploadedBy }).from(presentations).where(eq(presentations.id, id));
  if (!p) return "notfound";
  if (p.uploadedBy !== v.id && !ADMINS.includes(v.role)) return "forbidden";
  await db.delete(presentations).where(eq(presentations.id, id)); // progress cascades
  await rm(deckDir(id), { recursive: true, force: true }); // a running conversion notices the missing row and cleans up after itself
  return "ok";
}

export async function saveProgress(v: Viewer, id: number, page: number): Promise<boolean> {
  const [p] = await db.select({ pageCount: presentations.pageCount }).from(presentations).where(and(eq(presentations.id, id), eq(presentations.status, "ready")));
  if (!p?.pageCount) return false; // links have no page count: nothing to resume
  const clamped = Math.min(Math.max(1, Math.round(page)), p.pageCount);
  await db
    .insert(presentationProgress)
    .values({ userId: v.id, presentationId: id, page: clamped })
    .onConflictDoUpdate({ target: [presentationProgress.userId, presentationProgress.presentationId], set: { page: clamped, updatedAt: sql`now()` } });
  return true;
}

/** A chat link may only point at a ready deck; for a file deck, at a slide inside it (links have a single "page"). */
export async function checkSlideLink(id: number, page: number): Promise<{ ok: true } | { ok: false; code: 404 | 422; message: string }> {
  const [p] = await db.select({ pageCount: presentations.pageCount }).from(presentations).where(and(eq(presentations.id, id), eq(presentations.status, "ready")));
  if (!p) return { ok: false, code: 404, message: "Presentasi tidak ditemukan" };
  if (p.pageCount !== null && (page < 1 || page > p.pageCount)) return { ok: false, code: 422, message: `Slide harus antara 1 dan ${p.pageCount}` };
  return { ok: true };
}

export async function linkablePresentations() {
  return db
    .select({ id: presentations.id, title: presentations.title, pageCount: presentations.pageCount, hasCover: presentations.hasCover, kind: presentations.kind })
    .from(presentations)
    .where(eq(presentations.status, "ready"))
    .orderBy(desc(presentations.createdAt))
    .limit(200);
}
