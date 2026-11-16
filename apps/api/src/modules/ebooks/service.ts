import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { ebookProgress, ebooks, type Role, users } from "../../db/schema";
import { uploadDir } from "../../storage";

export const UPLOADERS = ["admin", "operator", "teacher", "staff"] as const satisfies readonly Role[];
const ADMINS: readonly Role[] = ["admin", "operator"];

export interface Viewer {
  id: number;
  role: Role;
}

const booksDir = join(uploadDir, "ebooks");
export const pdfFile = (id: number) => Bun.file(join(booksDir, `${id}.pdf`));
export const coverFile = (id: number) => Bun.file(join(booksDir, `${id}.cover`));

const columns = {
  id: ebooks.id,
  title: ebooks.title,
  description: ebooks.description,
  sizeBytes: ebooks.sizeBytes,
  pageCount: ebooks.pageCount,
  hasCover: sql<boolean>`${ebooks.coverMime} is not null`,
  createdAt: ebooks.createdAt,
  uploaderId: ebooks.uploadedBy,
  uploaderName: users.name,
  progressPage: ebookProgress.page,
};

const query = (viewerId: number) =>
  db
    .select(columns)
    .from(ebooks)
    .leftJoin(users, eq(ebooks.uploadedBy, users.id))
    .leftJoin(ebookProgress, sql`${ebookProgress.ebookId} = ${ebooks.id} and ${ebookProgress.userId} = ${viewerId}`);

type Row = Awaited<ReturnType<typeof query>>[number];
const shape = ({ uploaderId, uploaderName, ...b }: Row) => ({ ...b, uploader: uploaderId ? { id: uploaderId, name: uploaderName ?? "" } : null });

export async function listEbooks(v: Viewer) {
  return (await query(v.id).orderBy(sql`${ebooks.createdAt} desc`)).map(shape);
}

export async function hasCover(id: number): Promise<boolean> {
  const [row] = await db.select({ coverMime: ebooks.coverMime }).from(ebooks).where(eq(ebooks.id, id));
  return row?.coverMime != null;
}

export async function getEbook(v: Viewer, id: number) {
  const [row] = await query(v.id).where(eq(ebooks.id, id));
  return row ? shape(row) : null;
}

interface NewEbook {
  title: string;
  description: string;
  pageCount: number;
  file: File;
  cover?: { file: File; mime: string };
}

export async function createEbook(v: Viewer, input: NewEbook) {
  const [row] = await db
    .insert(ebooks)
    .values({ title: input.title, description: input.description, sizeBytes: input.file.size, pageCount: input.pageCount, coverMime: input.cover?.mime ?? null, uploadedBy: v.id })
    .returning({ id: ebooks.id });
  const id = row!.id;
  try {
    await mkdir(booksDir, { recursive: true });
    await Bun.write(pdfFile(id), input.file);
    if (input.cover) await Bun.write(coverFile(id), input.cover.file);
  } catch (e) {
    await removeFiles(id);
    await db.delete(ebooks).where(eq(ebooks.id, id)); // don't leave a book row without its file
    throw e;
  }
  return (await getEbook(v, id))!;
}

const removeFiles = (id: number) => Promise.all([rm(pdfFile(id).name!, { force: true }), rm(coverFile(id).name!, { force: true })]);

/** Uploader may delete their own book; admin/operator may delete any. */
export async function deleteEbook(v: Viewer, id: number): Promise<"ok" | "notfound" | "forbidden"> {
  const [book] = await db.select({ uploadedBy: ebooks.uploadedBy }).from(ebooks).where(eq(ebooks.id, id));
  if (!book) return "notfound";
  if (book.uploadedBy !== v.id && !ADMINS.includes(v.role)) return "forbidden";
  await db.delete(ebooks).where(eq(ebooks.id, id)); // progress rows cascade
  await removeFiles(id);
  return "ok";
}

export async function saveProgress(v: Viewer, id: number, page: number): Promise<boolean> {
  const [book] = await db.select({ pageCount: ebooks.pageCount }).from(ebooks).where(eq(ebooks.id, id));
  if (!book) return false;
  const clamped = Math.min(Math.max(1, Math.round(page)), book.pageCount);
  await db
    .insert(ebookProgress)
    .values({ userId: v.id, ebookId: id, page: clamped })
    .onConflictDoUpdate({ target: [ebookProgress.userId, ebookProgress.ebookId], set: { page: clamped, updatedAt: sql`now()` } });
  return true;
}
