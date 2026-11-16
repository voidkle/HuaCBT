import { desc, eq, or } from "drizzle-orm";
import { db } from "../../db";
import { type NoticeStatus, notices, type Role, users } from "../../db/schema";

/** Roles that may approve/reject notices; their own posts are published immediately. */
export const REVIEWERS = ["admin", "operator", "staff"] as const satisfies readonly Role[];
export const isReviewer = (role: Role) => (REVIEWERS as readonly Role[]).includes(role);

export interface Viewer {
  id: number;
  role: Role;
}
export interface NoticeInput {
  title: string;
  body: string;
}

type Failure = { ok: false; code: 403 | 404; message: string };
type Result<T> = { ok: true; value: T } | Failure;
const notFound: Failure = { ok: false, code: 404, message: "Pengumuman tidak ditemukan" };
const forbidden: Failure = { ok: false, code: 403, message: "Tidak diizinkan" };

const selectNotices = () =>
  db
    .select({
      id: notices.id,
      title: notices.title,
      body: notices.body,
      status: notices.status,
      reviewNote: notices.reviewNote,
      createdAt: notices.createdAt,
      reviewedAt: notices.reviewedAt,
      authorId: notices.authorId,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(notices)
    .innerJoin(users, eq(notices.authorId, users.id));

type Row = Awaited<ReturnType<typeof selectNotices>>[number];

const shape = ({ authorId, authorName, authorRole, ...n }: Row) => ({ ...n, author: { id: authorId, name: authorName, role: authorRole } });

/** Everyone sees approved notices; authors also see their own; reviewers see everything. */
const canSee = (v: Viewer, n: Pick<Row, "status" | "authorId">) => isReviewer(v.role) || n.status === "approved" || n.authorId === v.id;

// ponytail: no pagination, newest 200; add cursor paging when a school posts more than that
export async function listNotices(v: Viewer) {
  const rows = await selectNotices()
    .where(isReviewer(v.role) ? undefined : or(eq(notices.status, "approved"), eq(notices.authorId, v.id)))
    .orderBy(desc(notices.createdAt))
    .limit(200);
  return rows.map(shape);
}

async function load(v: Viewer, id: number): Promise<Row | undefined> {
  const [row] = await selectNotices().where(eq(notices.id, id));
  return row && canSee(v, row) ? row : undefined; // hide notices the viewer may not see
}

const reload = async (v: Viewer, id: number) => shape((await load(v, id))!);

export async function createNotice(v: Viewer, input: NoticeInput) {
  const approved = isReviewer(v.role);
  const [created] = await db
    .insert(notices)
    .values({
      title: input.title.trim(),
      body: input.body.trim(),
      authorId: v.id,
      status: approved ? "approved" : "pending",
      ...(approved && { reviewedBy: v.id, reviewedAt: new Date() }),
    })
    .returning({ id: notices.id });
  return reload(v, created!.id);
}

export async function updateNotice(v: Viewer, id: number, input: NoticeInput): Promise<Result<Awaited<ReturnType<typeof reload>>>> {
  const row = await load(v, id);
  if (!row) return notFound;
  if (row.authorId !== v.id) return forbidden;
  await db
    .update(notices)
    .set({
      title: input.title.trim(),
      body: input.body.trim(),
      // content changed: non-reviewers must be (re-)approved before it shows publicly again
      ...(!isReviewer(v.role) && { status: "pending" as const, reviewedBy: null, reviewNote: null, reviewedAt: null }),
    })
    .where(eq(notices.id, id));
  return { ok: true, value: await reload(v, id) };
}

export async function deleteNotice(v: Viewer, id: number): Promise<Result<true>> {
  const row = await load(v, id);
  if (!row) return notFound;
  if (row.authorId !== v.id && !isReviewer(v.role)) return forbidden;
  await db.delete(notices).where(eq(notices.id, id));
  return { ok: true, value: true };
}

/** Caller must already be a reviewer (route-level role check). */
export async function reviewNotice(v: Viewer, id: number, status: Extract<NoticeStatus, "approved" | "rejected">, note?: string) {
  const row = await load(v, id);
  if (!row) return notFound;
  await db
    .update(notices)
    .set({ status, reviewedBy: v.id, reviewedAt: new Date(), reviewNote: status === "rejected" ? note?.trim() || null : null })
    .where(eq(notices.id, id));
  return { ok: true, value: await reload(v, id) } as const;
}
