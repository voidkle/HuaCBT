import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { type Role, users, videoCues, videoProgress, videos } from "../../db/schema";
import { getSettings } from "../config/service";
import { parseCaptions, toVtt } from "./captions";
import { readCues, replaceCues } from "./cuesStore";
import { enqueue } from "./jobs";
import { makePoster, probeVideo } from "./media";
import { partPath, posterPath, tmpDir, videoPath, videosDir } from "./paths";

export interface Viewer {
  id: number;
  role: Role;
}

type Failure = { ok: false; code: 403 | 404 | 409 | 413 | 422; message: string; received?: number };
export type Result<T> = { ok: true; value: T } | Failure;
const fail = (code: Failure["code"], message: string, received?: number): Failure => ({ ok: false, code, message, received });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

const MB = 1024 * 1024;
export const CHUNK_BYTES = 8 * MB;
export const MAX_CHUNK_BYTES = 16 * MB;

/** Teacher, staff, admin and operator publish at once and approve other people's uploads; students wait for approval. */
export const REVIEWERS = ["admin", "operator", "teacher", "staff"] as const satisfies readonly Role[];
export const isReviewer = (role: Role) => (REVIEWERS as readonly Role[]).includes(role);
const isAdmin = (role: Role) => role === "admin" || role === "operator";

type Video = typeof videos.$inferSelect;

// ---------------------------------------------------------------- visibility

/** Approved + ready videos are public; the uploader sees their own; reviewers see every ready upload. */
const visibleTo = (v: Viewer) => or(and(eq(videos.status, "ready"), eq(videos.approval, "approved")), eq(videos.uploadedBy, v.id), isReviewer(v.role) ? eq(videos.status, "ready") : undefined)!;

const canManage = (v: Viewer, video: Pick<Video, "uploadedBy">) => video.uploadedBy === v.id || isAdmin(v.role);

const columns = {
  id: videos.id,
  title: videos.title,
  description: videos.description,
  status: videos.status,
  approval: videos.approval,
  reviewNote: videos.reviewNote,
  durationSec: videos.durationSec,
  width: videos.width,
  height: videos.height,
  hasPoster: videos.hasPoster,
  createdAt: videos.createdAt,
  transcriptStatus: videos.transcriptStatus,
  summaryStatus: videos.summaryStatus,
  uploaderId: videos.uploadedBy,
  uploaderName: users.name,
  uploaderRole: users.role,
  progressSec: videoProgress.positionSec,
  // detail-only fields are selected here too (cheap) and trimmed in shapeList
  transcriptSource: videos.transcriptSource,
  transcriptError: videos.transcriptError,
  summaryText: videos.summaryText,
  chapters: videos.chapters,
  summaryError: videos.summaryError,
  failureReason: videos.failureReason,
  originalName: videos.originalName,
};

const query = (viewerId: number) =>
  db
    .select(columns)
    .from(videos)
    .leftJoin(users, eq(videos.uploadedBy, users.id))
    .leftJoin(videoProgress, sql`${videoProgress.videoId} = ${videos.id} and ${videoProgress.userId} = ${viewerId}`);

type Row = Awaited<ReturnType<typeof query>>[number];

const summaryOf = ({ uploaderId, uploaderName, uploaderRole, progressSec, transcriptSource: _a, transcriptError: _b, summaryText: _c, chapters: _d, summaryError: _e, failureReason, originalName: _f, ...r }: Row) => ({
  ...r,
  failureReason,
  progressSec: progressSec ?? null,
  uploader: uploaderId ? { id: uploaderId, name: uploaderName ?? "", role: uploaderRole! } : null,
});

const detailOf = (r: Row) => ({
  ...summaryOf(r),
  transcriptSource: r.transcriptSource,
  transcriptError: r.transcriptError,
  summary: r.summaryText ? { text: r.summaryText, chapters: r.chapters ?? [] } : null,
  summaryError: r.summaryError,
  originalName: r.originalName,
});

export async function listVideos(v: Viewer) {
  return (await query(v.id).where(visibleTo(v)).orderBy(desc(videos.createdAt))).map(summaryOf);
}

export async function getVideo(v: Viewer, id: number) {
  const [row] = await query(v.id).where(and(eq(videos.id, id), visibleTo(v)));
  return row ? detailOf(row) : null;
}

async function loadVisible(v: Viewer, id: number): Promise<Video | null> {
  const [row] = await db.select().from(videos).where(and(eq(videos.id, id), visibleTo(v)));
  return row ?? null;
}

// ---------------------------------------------------------------- chunked upload

export async function createUpload(v: Viewer, input: { title: string; description: string; filename: string; sizeBytes: number }): Promise<Result<{ id: number; chunkBytes: number }>> {
  const { maxVideoMb } = await getSettings();
  if (input.sizeBytes > maxVideoMb * MB) return fail(413, `Ukuran video maksimal ${maxVideoMb} MB`);
  const reviewer = isReviewer(v.role);
  const [row] = await db
    .insert(videos)
    .values({
      title: input.title.trim(),
      description: input.description.trim(),
      uploadedBy: v.id,
      originalName: input.filename.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").slice(0, 200),
      declaredBytes: input.sizeBytes,
      approval: reviewer ? "approved" : "pending",
      ...(reviewer && { reviewedBy: v.id, reviewedAt: new Date() }),
    })
    .returning({ id: videos.id });
  await mkdir(videosDir, { recursive: true });
  await Bun.write(partPath(row!.id), "");
  return ok({ id: row!.id, chunkBytes: CHUNK_BYTES });
}

async function ownUpload(v: Viewer, id: number): Promise<Result<Video>> {
  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video || video.uploadedBy !== v.id) return fail(404, "Unggahan tidak ditemukan");
  if (video.status !== "uploading") return fail(409, "Unggahan ini sudah selesai");
  return ok(video);
}

const partSize = async (id: number) => (await stat(partPath(id)).catch(() => null))?.size ?? 0;

/** How many bytes the server already has: lets a client resume after a dropped connection. */
export async function uploadProgress(v: Viewer, id: number): Promise<Result<{ received: number; total: number }>> {
  const own = await ownUpload(v, id);
  if (!own.ok) return own;
  return ok({ received: await partSize(id), total: own.value.declaredBytes });
}

/** Appends one chunk. `offset` must equal what the server has, which makes retries safe (never duplicates or gaps). */
export async function appendChunk(v: Viewer, id: number, offset: number, data: Uint8Array): Promise<Result<{ received: number }>> {
  const own = await ownUpload(v, id);
  if (!own.ok) return own;
  const have = await partSize(id);
  if (offset !== have) return fail(409, "Posisi unggahan tidak sesuai", have);
  if (data.byteLength === 0) return fail(422, "Potongan kosong");
  if (have + data.byteLength > own.value.declaredBytes) return fail(422, "Data melebihi ukuran yang dinyatakan");
  await appendFile(partPath(id), data);
  return ok({ received: have + data.byteLength });
}

async function markFailed(id: number, reason: string) {
  await rm(partPath(id), { force: true });
  await db.update(videos).set({ status: "failed", failureReason: reason }).where(eq(videos.id, id));
}

/** Validates the finished file (real video? playable in browsers?), makes a poster and publishes it for review. */
export async function completeUpload(v: Viewer, id: number): Promise<Result<NonNullable<Awaited<ReturnType<typeof getVideo>>>>> {
  const own = await ownUpload(v, id);
  if (!own.ok) return own;
  const have = await partSize(id);
  if (have !== own.value.declaredBytes) return fail(409, "Unggahan belum lengkap", have);

  const probed = await probeVideo(partPath(id));
  if (!probed.ok) {
    await markFailed(id, probed.message);
    return fail(422, probed.message);
  }
  const { probe } = probed;
  await rename(partPath(id), videoPath(id, probe.mime));
  const hasPoster = await makePoster(videoPath(id, probe.mime), posterPath(id), probe.durationSec);
  await db.update(videos).set({ status: "ready", mime: probe.mime, durationSec: probe.durationSec, width: probe.width, height: probe.height, hasPoster }).where(eq(videos.id, id));
  return ok((await getVideo(v, id))!);
}

// ---------------------------------------------------------------- manage

async function removeFiles(id: number) {
  await Promise.all([partPath(id), videoPath(id, "video/mp4"), videoPath(id, "video/webm"), posterPath(id)].map((p) => rm(p, { force: true })));
  await rm(tmpDir(id), { recursive: true, force: true });
}

export async function deleteVideo(v: Viewer, id: number): Promise<Result<true>> {
  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  if (!video) return fail(404, "Video tidak ditemukan");
  if (!canManage(v, video)) return (await loadVisible(v, id)) ? fail(403, "Hanya pengunggah, admin, atau operator yang dapat menghapus") : fail(404, "Video tidak ditemukan"); // do not reveal hidden videos
  await db.delete(videos).where(eq(videos.id, id)); // cues and progress cascade
  await removeFiles(id);
  return ok(true);
}

/** Title/description edits by non-reviewers send an approved video back to review (they could otherwise rename it to anything). */
export async function updateVideo(v: Viewer, id: number, input: { title: string; description: string }): Promise<Result<true>> {
  const video = await loadVisible(v, id);
  if (!video) return fail(404, "Video tidak ditemukan");
  if (!canManage(v, video)) return fail(403, "Hanya pengunggah, admin, atau operator yang dapat mengubah");
  const reset = !isReviewer(v.role) && video.approval === "approved";
  await db
    .update(videos)
    .set({ title: input.title.trim(), description: input.description.trim(), ...(reset && { approval: "pending" as const, reviewNote: null, reviewedBy: null, reviewedAt: null }) })
    .where(eq(videos.id, id));
  return ok(true);
}

export async function reviewVideo(v: Viewer, id: number, decision: "approved" | "rejected", note?: string): Promise<Result<true>> {
  const video = await loadVisible(v, id);
  if (!video || video.status !== "ready") return fail(404, "Video tidak ditemukan");
  await db
    .update(videos)
    .set({ approval: decision, reviewedBy: v.id, reviewedAt: new Date(), reviewNote: decision === "rejected" ? note?.trim() || null : null })
    .where(eq(videos.id, id));
  return ok(true);
}

export async function saveProgress(v: Viewer, id: number, positionSec: number): Promise<Result<true>> {
  const video = await loadVisible(v, id);
  if (!video || video.status !== "ready") return fail(404, "Video tidak ditemukan");
  const clamped = Math.min(Math.max(0, positionSec), video.durationSec ?? positionSec);
  await db
    .insert(videoProgress)
    .values({ userId: v.id, videoId: id, positionSec: clamped })
    .onConflictDoUpdate({ target: [videoProgress.userId, videoProgress.videoId], set: { positionSec: clamped, updatedAt: sql`now()` } });
  return ok(true);
}

// ---------------------------------------------------------------- files

export async function playableFile(v: Viewer, id: number): Promise<Result<{ path: string; mime: string }>> {
  const video = await loadVisible(v, id);
  if (!video || video.status !== "ready" || !video.mime) return fail(404, "Video tidak ditemukan");
  return ok({ path: videoPath(id, video.mime), mime: video.mime });
}

export async function posterFile(v: Viewer, id: number): Promise<Result<string>> {
  const video = await loadVisible(v, id);
  if (!video || !video.hasPoster) return fail(404, "Poster tidak ditemukan");
  return ok(posterPath(id));
}

// ---------------------------------------------------------------- transcript + summary

async function manageable(v: Viewer, id: number): Promise<Result<Video>> {
  const video = await loadVisible(v, id);
  if (!video || video.status !== "ready") return fail(404, "Video tidak ditemukan");
  return ok(video);
}

/** The cues of a visible video (empty array when there is no transcript). */
export async function getCues(v: Viewer, id: number): Promise<Result<{ startMs: number; endMs: number; text: string }[]>> {
  const video = await loadVisible(v, id);
  if (!video) return fail(404, "Video tidak ditemukan");
  return ok(await readCues(id)); // status only describes the latest job: a failed re-run keeps the previous transcript
}

export async function getVtt(v: Viewer, id: number): Promise<Result<string>> {
  const cues = await getCues(v, id);
  if (!cues.ok) return cues;
  return cues.value.length ? ok(toVtt(cues.value)) : fail(404, "Belum ada transkrip");
}

/** Free path: the uploader or any reviewer uploads a .vtt/.srt. */
export async function saveCaptions(v: Viewer, id: number, content: string): Promise<Result<{ cues: number }>> {
  const m = await manageable(v, id);
  if (!m.ok) return m;
  if (!canManage(v, m.value) && !isReviewer(v.role)) return fail(403, "Kamu tidak boleh mengubah transkrip video ini");
  const parsed = parseCaptions(content);
  if (!parsed.ok) return fail(422, parsed.message);
  await replaceCues(id, parsed.cues);
  await db.update(videos).set({ transcriptStatus: "ready", transcriptSource: "manual", transcriptError: null }).where(eq(videos.id, id));
  return ok({ cues: parsed.cues.length });
}

export async function clearTranscript(v: Viewer, id: number): Promise<Result<true>> {
  const m = await manageable(v, id);
  if (!m.ok) return m;
  if (!canManage(v, m.value) && !isReviewer(v.role)) return fail(403, "Kamu tidak boleh mengubah transkrip video ini");
  await db.delete(videoCues).where(eq(videoCues.videoId, id));
  await db.update(videos).set({ transcriptStatus: "none", transcriptSource: null, transcriptError: null }).where(eq(videos.id, id));
  return ok(true);
}

/** Paid/heavy actions are for reviewers only (a student must not be able to spend the school's AI budget). */
export async function requestTranscript(v: Viewer, id: number): Promise<Result<true>> {
  if (!isReviewer(v.role)) return fail(403, "Hanya guru, staf, admin, atau operator yang dapat membuat transkrip otomatis");
  const m = await manageable(v, id);
  if (!m.ok) return m;
  const cfg = await getSettings();
  if (!cfg.transcriptionEnabled) return fail(422, "Transkrip otomatis belum diaktifkan di halaman Pengaturan");
  if (m.value.transcriptStatus === "queued" || m.value.transcriptStatus === "processing") return fail(409, "Transkrip sedang diproses");
  await db.update(videos).set({ transcriptStatus: "queued", transcriptError: null }).where(eq(videos.id, id));
  enqueue("transcript", id);
  return ok(true);
}

export async function requestSummary(v: Viewer, id: number): Promise<Result<true>> {
  if (!isReviewer(v.role)) return fail(403, "Hanya guru, staf, admin, atau operator yang dapat membuat ringkasan AI");
  const m = await manageable(v, id);
  if (!m.ok) return m;
  const cfg = await getSettings();
  if (!cfg.aiSummaryEnabled) return fail(422, "Ringkasan AI belum diaktifkan di halaman Pengaturan");
  if (m.value.transcriptStatus !== "ready") return fail(422, "Buat atau unggah transkrip terlebih dahulu");
  if (m.value.summaryStatus === "queued" || m.value.summaryStatus === "processing") return fail(409, "Ringkasan sedang dibuat");
  await db.update(videos).set({ summaryStatus: "queued", summaryError: null }).where(eq(videos.id, id));
  enqueue("summary", id);
  return ok(true);
}

// ---------------------------------------------------------------- for the chat Linker

export async function linkableVideos() {
  return db
    .select({ id: videos.id, title: videos.title, durationSec: videos.durationSec, hasPoster: videos.hasPoster })
    .from(videos)
    .where(and(eq(videos.status, "ready"), eq(videos.approval, "approved")))
    .orderBy(desc(videos.createdAt))
    .limit(200);
}

/** A chat link may only point at a published video, at a moment inside it. */
export async function checkVideoLink(id: number, seconds: number): Promise<{ ok: true } | { ok: false; code: 404 | 422; message: string }> {
  const [video] = await db.select({ durationSec: videos.durationSec }).from(videos).where(and(eq(videos.id, id), eq(videos.status, "ready"), eq(videos.approval, "approved")));
  if (!video) return { ok: false, code: 404, message: "Video tidak ditemukan" };
  if (seconds < 0 || seconds > (video.durationSec ?? 0)) return { ok: false, code: 422, message: `Waktu harus antara 0 dan ${Math.floor(video.durationSec ?? 0)} detik` };
  return { ok: true };
}
