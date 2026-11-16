import { rm } from "node:fs/promises";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "../../db";
import { videos } from "../../db/schema";
import { getSettings } from "../config/service";
import type { Cue } from "./captions";
import { readCues, replaceCues } from "./cuesStore";
import { extractAudioChunks, hasAudioStream } from "./media";
import { tmpDir, videoPath } from "./paths";
import { ProviderError, summarize, transcribeChunk } from "./providers";

type JobKind = "transcript" | "summary";
const queue: { kind: JobKind; videoId: number }[] = [];
let running = false;

// speech APIs cap uploads (OpenAI: 25 MB): 15 min of mono 32 kbps MP3 is ~3.5 MB. Overridable so tests can exercise chunk merging.
const chunkSeconds = () => Number(process.env.VIDEO_AUDIO_CHUNK_SECONDS ?? 15 * 60);

/** Only messages we wrote ourselves reach the UI: unexpected errors are logged and shown generically. */
const messageOf = (e: unknown, fallback: string) => (e instanceof ProviderError ? e.message : (console.error(fallback, e), fallback));

async function runTranscript(videoId: number) {
  const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
  if (!video) return;
  if (video.status !== "ready" || !video.mime) return void (await db.update(videos).set({ transcriptStatus: "failed", transcriptError: "Video belum siap." }).where(eq(videos.id, videoId)));
  await db.update(videos).set({ transcriptStatus: "processing", transcriptError: null }).where(eq(videos.id, videoId));
  try {
    const cfg = await getSettings();
    if (!cfg.transcriptionEnabled) throw new ProviderError("Transkrip otomatis dimatikan di pengaturan.");
    const seconds = chunkSeconds();
    if (!(await hasAudioStream(videoPath(videoId, video.mime)))) throw new ProviderError("Video tidak memiliki suara untuk ditranskrip.");
    const files = await extractAudioChunks(videoPath(videoId, video.mime), tmpDir(videoId), seconds);
    if (files.length === 0) throw new ProviderError("Video tidak memiliki suara untuk ditranskrip.");
    const all: Cue[] = [];
    for (const [i, file] of files.entries()) {
      const offset = i * seconds * 1000;
      const cues = await transcribeChunk(Bun.file(file), { baseUrl: cfg.transcriptionBaseUrl, model: cfg.transcriptionModel, apiKey: cfg.transcriptionApiKey, language: cfg.transcriptionLanguage });
      all.push(...cues.map((c) => ({ ...c, startMs: c.startMs + offset, endMs: c.endMs + offset })));
    }
    if (all.length === 0) throw new ProviderError("Tidak ada ucapan yang terdeteksi di video ini.");
    await replaceCues(videoId, all);
    await db.update(videos).set({ transcriptStatus: "ready", transcriptSource: "auto", transcriptError: null }).where(eq(videos.id, videoId));
  } catch (e) {
    await db.update(videos).set({ transcriptStatus: "failed", transcriptError: messageOf(e, "Terjadi kesalahan saat membuat transkrip.") }).where(eq(videos.id, videoId));
  } finally {
    await rm(tmpDir(videoId), { recursive: true, force: true });
  }
}

async function runSummary(videoId: number) {
  const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
  if (!video) return;
  await db.update(videos).set({ summaryStatus: "processing", summaryError: null }).where(eq(videos.id, videoId));
  try {
    const cfg = await getSettings();
    if (!cfg.aiSummaryEnabled) throw new ProviderError("Ringkasan AI dimatikan di pengaturan.");
    const cues = await readCues(videoId);
    if (cues.length === 0) throw new ProviderError("Buat atau unggah transkrip terlebih dahulu.");
    const result = await summarize(cues, video.durationSec ?? Number.MAX_SAFE_INTEGER, { baseUrl: cfg.aiBaseUrl, model: cfg.aiModel, apiKey: cfg.aiApiKey });
    await db.update(videos).set({ summaryStatus: "ready", summaryText: result.summary, chapters: result.chapters, summaryError: null, summaryAt: new Date() }).where(eq(videos.id, videoId));
  } catch (e) {
    await db.update(videos).set({ summaryStatus: "failed", summaryError: messageOf(e, "Terjadi kesalahan saat membuat ringkasan.") }).where(eq(videos.id, videoId));
  }
}

async function pump() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift()!;
      try {
        await (job.kind === "transcript" ? runTranscript(job.videoId) : runSummary(job.videoId));
      } catch (e) {
        console.error(`video job ${job.kind} #${job.videoId} crashed`, e);
      }
    }
  } finally {
    running = false;
  }
}

/** Jobs run one at a time, in order (each one is CPU- or API-heavy). State lives in the DB, so it survives restarts. */
export function enqueue(kind: JobKind, videoId: number) {
  if (queue.some((j) => j.kind === kind && j.videoId === videoId)) return;
  queue.push({ kind, videoId });
  void pump();
}

/** After a restart, anything that was waiting or mid-run goes back in the queue. */
export async function recoverJobs() {
  const stuck = await db
    .select({ id: videos.id, t: videos.transcriptStatus, s: videos.summaryStatus })
    .from(videos)
    .where(or(inArray(videos.transcriptStatus, ["queued", "processing"]), inArray(videos.summaryStatus, ["queued", "processing"])));
  for (const v of stuck) {
    if (v.t === "queued" || v.t === "processing") {
      await db.update(videos).set({ transcriptStatus: "queued" }).where(eq(videos.id, v.id));
      enqueue("transcript", v.id);
    }
    if (v.s === "queued" || v.s === "processing") {
      await db.update(videos).set({ summaryStatus: "queued" }).where(eq(videos.id, v.id));
      enqueue("summary", v.id);
    }
  }
}

/** Test helper: resolves when the queue is empty. */
export async function idle() {
  while (running || queue.length) await new Promise((r) => setTimeout(r, 25));
}
