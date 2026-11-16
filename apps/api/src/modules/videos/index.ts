import { Elysia, t } from "elysia";
import { serveFile } from "../../http/serveFile";
import { authPlugin } from "../../plugins/auth";
import { appendChunk, clearTranscript, completeUpload, createUpload, deleteVideo, getCues, getVideo, getVtt, listVideos, MAX_CHUNK_BYTES, playableFile, posterFile, REVIEWERS, requestSummary, requestTranscript, reviewVideo, saveCaptions, saveProgress, updateVideo, uploadProgress } from "./service";

// ponytail: no `params`/`query` schemas (Elysia 1.4.32 + Bun frozen objects -> 500 on a real server); parse by hand
const idOf = (raw: string | undefined) => (raw && /^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const notFound = { message: "Video tidak ditemukan" };

type Failure = { ok: false; code: 403 | 404 | 409 | 413 | 422; message: string; received?: number };
const respond = <T>(r: { ok: true; value: T } | Failure, status: (code: Failure["code"], body: { message: string; received?: number }) => unknown) =>
  r.ok ? r.value : status(r.code, r.received === undefined ? { message: r.message } : { message: r.message, received: r.received });

const text = (max: number) => t.String({ minLength: 1, maxLength: max, pattern: "\\S" });
const meta = t.Object({ title: text(150), description: t.String({ maxLength: 2000 }) });

const mediaHeaders = { "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" };

export const videosModule = new Elysia({ prefix: "/videos" })
  .use(authPlugin)
  .get("/", ({ user }) => listVideos(user), { role: true })
  .post(
    "/",
    async ({ user, body, status }) => respond(await createUpload(user, body), status),
    { role: true, body: t.Object({ title: text(150), description: t.String({ maxLength: 2000 }), filename: t.String({ maxLength: 300 }), sizeBytes: t.Integer({ minimum: 1 }) }) },
  )
  .get("/:id", async ({ user, params, status }) => {
    const id = idOf(params.id);
    const video = id ? await getVideo(user, id) : null;
    return video ?? status(404, notFound);
  }, { role: true })
  .patch("/:id", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await updateVideo(user, id, body), status) : status(404, notFound);
  }, { role: true, body: meta })
  .delete("/:id", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await deleteVideo(user, id), status) : status(404, notFound);
  }, { role: true })

  // ---------------------------------------------------------------- resumable upload
  .get("/:id/upload", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await uploadProgress(user, id), status) : status(404, notFound);
  }, { role: true })
  .patch(
    "/:id/upload",
    async ({ user, params, request, status }) => {
      const id = idOf(params.id);
      if (!id) return status(404, notFound);
      const offset = Number(new URL(request.url).searchParams.get("offset"));
      if (!Number.isSafeInteger(offset) || offset < 0) return status(422, { message: "Posisi unggahan tidak valid" });
      if (Number(request.headers.get("content-length") ?? 0) > MAX_CHUNK_BYTES) return status(413, { message: "Potongan terlalu besar" }); // refuse before reading the body
      const data = new Uint8Array(await request.arrayBuffer());
      if (data.byteLength > MAX_CHUNK_BYTES) return status(413, { message: "Potongan terlalu besar" });
      return respond(await appendChunk(user, id, offset, data), status);
    },
    { role: true, parse: "none" }, // the raw bytes are the body: skip Elysia's body parsing
  )
  .post("/:id/complete", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await completeUpload(user, id), status) : status(404, notFound);
  }, { role: true })

  // ---------------------------------------------------------------- review (students' uploads)
  .post("/:id/approve", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await reviewVideo(user, id, "approved"), status) : status(404, notFound);
  }, { role: REVIEWERS })
  .post("/:id/reject", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await reviewVideo(user, id, "rejected", body?.note), status) : status(404, notFound);
  }, { role: REVIEWERS, body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 300 })) })) })

  // ---------------------------------------------------------------- watching
  .put("/:id/progress", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await saveProgress(user, id, body.position), status) : status(404, notFound);
  }, { role: true, body: t.Object({ position: t.Number({ minimum: 0, maximum: 86400 }) }) })
  .get("/:id/file", async ({ user, params, request, status }) => {
    const id = idOf(params.id);
    const r = id ? await playableFile(user, id) : null;
    if (!r?.ok) return status(r?.code ?? 404, { message: r?.message ?? notFound.message });
    const file = Bun.file(r.value.path);
    if (!(await file.exists())) return status(404, notFound);
    return serveFile(file, request.headers.get("range"), { "content-type": r.value.mime, ...mediaHeaders });
  }, { role: true })
  .get("/:id/poster", async ({ user, params, status }) => {
    const id = idOf(params.id);
    const r = id ? await posterFile(user, id) : null;
    if (!r?.ok) return status(r?.code ?? 404, { message: r?.message ?? notFound.message });
    const file = Bun.file(r.value);
    if (!(await file.exists())) return status(404, notFound);
    return new Response(file, { headers: { "content-type": "image/jpeg", ...mediaHeaders, "cache-control": "private, max-age=86400" } });
  }, { role: true })
  .get("/:id/captions.vtt", async ({ user, params, status }) => {
    const id = idOf(params.id);
    const r = id ? await getVtt(user, id) : null;
    if (!r?.ok) return status(r?.code ?? 404, { message: r?.message ?? notFound.message });
    return new Response(r.value, { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, no-cache", "x-content-type-options": "nosniff" } });
  }, { role: true })
  .get("/:id/transcript", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await getCues(user, id), status) : status(404, notFound);
  }, { role: true })

  // ---------------------------------------------------------------- transcript + summary
  .post("/:id/transcript", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await requestTranscript(user, id), status) : status(404, notFound);
  }, { role: true })
  .put("/:id/captions", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await saveCaptions(user, id, body.content), status) : status(404, notFound);
  }, { role: true, body: t.Object({ content: t.String({ minLength: 1, maxLength: 3_000_000 }) }) })
  .delete("/:id/transcript", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await clearTranscript(user, id), status) : status(404, notFound);
  }, { role: true })
  .post("/:id/summary", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await requestSummary(user, id), status) : status(404, notFound);
  }, { role: true });
