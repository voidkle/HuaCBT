import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { ProviderError } from "./providers";

/** Runs a program with a hard timeout; never goes through a shell, so file names cannot inject anything. */
export async function run(cmd: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  try {
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    return { code, stdout, stderr };
  } finally {
    clearTimeout(timer);
  }
}

export interface Probe {
  mime: "video/mp4" | "video/webm";
  ext: "mp4" | "webm";
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

// what current browsers can play natively, per container (HEVC/ProRes/AC-3 etc. cannot, and would show a black screen).
// ffprobe reports both WebM and Matroska (MKV) as "matroska,webm", so the codecs are what tells a real WebM from an MKV.
const RULES = {
  mp4: { video: new Set(["h264", "vp9", "av1"]), audio: new Set(["aac", "mp3", "opus"]) },
  webm: { video: new Set(["vp8", "vp9", "av1"]), audio: new Set(["opus", "vorbis"]) },
} as const;
const MAX_DURATION_SEC = 12 * 3600;

interface FfprobeJson {
  format?: { format_name?: string; duration?: string };
  streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[];
}

export async function probeVideo(path: string): Promise<{ ok: true; probe: Probe } | { ok: false; message: string }> {
  let result;
  try {
    result = await run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path], 30_000);
  } catch {
    return { ok: false, message: "Server belum memiliki ffprobe/ffmpeg, jadi video tidak dapat diperiksa." };
  }
  if (result.code !== 0) return { ok: false, message: "Berkas ini bukan video yang valid atau rusak." };
  let info: FfprobeJson;
  try {
    info = JSON.parse(result.stdout);
  } catch {
    return { ok: false, message: "Berkas ini bukan video yang valid atau rusak." };
  }
  const formats = (info.format?.format_name ?? "").split(",");
  const ext = formats.includes("mp4") ? "mp4" : formats.includes("webm") ? "webm" : null;
  if (!ext) return { ok: false, message: "Format video harus MP4 atau WebM." };
  const video = info.streams?.find((s) => s.codec_type === "video");
  if (!video) return { ok: false, message: "Berkas tidak berisi gambar video." };
  const audio = info.streams?.find((s) => s.codec_type === "audio");
  if (!RULES[ext].video.has(video.codec_name ?? "")) {
    return { ok: false, message: ext === "webm" ? `Berkas ini bukan WebM yang valid (mungkin MKV dengan codec "${video.codec_name}"). Gunakan MP4 (H.264/AAC) atau WebM (VP9/Opus).` : `Codec video "${video.codec_name}" tidak bisa diputar di browser. Ubah ke H.264 (MP4) atau VP9 (WebM).` };
  }
  if (audio && !RULES[ext].audio.has(audio.codec_name ?? "")) return { ok: false, message: `Codec audio "${audio.codec_name}" tidak bisa diputar di browser. Ubah ke AAC (MP4) atau Opus (WebM).` };
  const durationSec = Number(info.format?.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0) return { ok: false, message: "Durasi video tidak terbaca." };
  if (durationSec > MAX_DURATION_SEC) return { ok: false, message: "Durasi video maksimal 12 jam." };
  return { ok: true, probe: { mime: ext === "webm" ? "video/webm" : "video/mp4", ext, durationSec, width: video.width ?? 0, height: video.height ?? 0, hasAudio: audio !== undefined } };
}

/** A JPEG frame near the start, as the card thumbnail. Best effort: a missing poster is not fatal. */
export async function makePoster(videoPath: string, outPath: string, durationSec: number): Promise<boolean> {
  const at = Math.min(1, durationSec / 10).toFixed(2);
  try {
    const r = await run(["ffmpeg", "-y", "-loglevel", "error", "-ss", at, "-i", videoPath, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", outPath], 60_000);
    return r.code === 0 && (await Bun.file(outPath).exists());
  } catch {
    return false;
  }
}

/**
 * Extracts mono 16 kHz speech audio as MP3 pieces of `chunkSeconds` (speech APIs cap uploads, e.g. 25 MB:
 * 15 min at 32 kbps is ~3.5 MB). Returns the piece paths in order; the caller removes `dir` afterwards.
 */
/** Does the file have any audio track? (a silent screen recording cannot be transcribed). */
export async function hasAudioStream(path: string): Promise<boolean> {
  const r = await run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path], 30_000);
  return r.code === 0 && r.stdout.trim() !== "";
}

export async function extractAudioChunks(videoPath: string, dir: string, chunkSeconds: number): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const r = await run(["ffmpeg", "-y", "-loglevel", "error", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-f", "segment", "-segment_time", String(chunkSeconds), "-reset_timestamps", "1", join(dir, "chunk-%04d.mp3")], 60 * 60_000);
  if (r.code !== 0) {
    await rm(dir, { recursive: true, force: true });
    throw new ProviderError("Suara video tidak dapat diekstrak.");
  }
  return (await readdir(dir)).filter((f) => f.endsWith(".mp3")).sort().map((f) => join(dir, f));
}
