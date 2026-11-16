import { API_URL, api } from "@/services/api";
import { ApiError, unwrap } from "@/services/unwrap";
import type { VideoDetail } from "../types";

export interface UploadInput {
  file: File;
  title: string;
  description: string;
}

export interface UploadHandlers {
  /** 0..1 of the bytes the server has confirmed. */
  onProgress: (fraction: number) => void;
  /** The file is fully uploaded; the server is now checking it (ffprobe, poster). */
  onProcessing: () => void;
  signal: AbortSignal;
}

const MAX_RETRIES = 5;
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("Dibatalkan", "AbortError"))), { once: true });
  });

/** PATCHes one chunk. Returns the server's byte count, or throws (ApiError for refusals, TypeError for network failures). */
async function sendChunk(id: number, offset: number, chunk: Blob, signal: AbortSignal): Promise<number> {
  const res = await fetch(`${API_URL}/videos/${id}/upload?offset=${offset}`, { method: "PATCH", credentials: "include", headers: { "content-type": "application/octet-stream" }, body: chunk, signal });
  const json = (await res.json().catch(() => null)) as { received?: number; message?: string } | null;
  if (res.ok && typeof json?.received === "number") return json.received;
  // 409 carries the server's position: the caller resyncs to it instead of failing
  throw Object.assign(new ApiError(json?.message ?? "Gagal mengunggah", res.status), { received: json?.received });
}

/**
 * Uploads a video in chunks written straight to disk on the server (no size is ever held in memory). A dropped connection
 * is retried with backoff, and the server's byte count is the source of truth: a refused or duplicated chunk resyncs.
 * Returns the finished video. Aborting deletes the half-uploaded file on the server.
 */
export async function uploadVideo(input: UploadInput, h: UploadHandlers): Promise<VideoDetail> {
  const { file } = input;
  const created = unwrap<{ id: number; chunkBytes: number }>(await api.videos.post({ title: input.title, description: input.description, filename: file.name, sizeBytes: file.size }));
  const { id, chunkBytes } = created;
  try {
    let offset = 0;
    let failures = 0;
    while (offset < file.size) {
      if (h.signal.aborted) throw new DOMException("Dibatalkan", "AbortError");
      try {
        offset = await sendChunk(id, offset, file.slice(offset, offset + chunkBytes), h.signal);
        failures = 0;
        h.onProgress(offset / file.size);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        const resync = (e as { received?: number }).received;
        if (e instanceof ApiError && e.status === 409 && typeof resync === "number") {
          offset = resync; // the server already has more (or less) than we thought: continue from its position
          continue;
        }
        if (e instanceof ApiError && e.status !== null && e.status < 500) throw e; // a real refusal (too large, not allowed...): do not retry
        if (++failures > MAX_RETRIES) throw new ApiError("Koneksi terputus. Coba unggah lagi.", null);
        await sleep(Math.min(8000, 500 * 2 ** failures), h.signal); // network blip: wait, then try the same chunk again
      }
    }
    h.onProcessing();
    return unwrap<VideoDetail>(await api.videos({ id }).complete.post());
  } catch (e) {
    await api.videos({ id }).delete().catch(() => undefined); // do not leave a half-finished upload behind
    throw e;
  }
}
