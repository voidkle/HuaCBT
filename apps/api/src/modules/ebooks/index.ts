import { fileTypeFromBuffer } from "file-type";
import { Elysia, t } from "elysia";
import { serveFile } from "../../http/serveFile";
import { authPlugin } from "../../plugins/auth";
import { getSettings } from "../config/service";
import { coverFile, createEbook, deleteEbook, getEbook, hasCover, listEbooks, pdfFile, saveProgress, UPLOADERS } from "./service";

const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MB = 1024 * 1024;

// ponytail: no `params` schema (Elysia 1.4.32 + Bun frozen params -> 500 on a real server); parse ids by hand
const idOf = (raw: string) => (/^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const notFound = { message: "E-book tidak ditemukan" };

const upload = t.Object({
  file: t.File(), // size is checked against the configurable limit in the handler
  cover: t.Optional(t.File({ maxSize: "1m" })),
  title: t.String({ minLength: 1, maxLength: 150, pattern: "\\S" }),
  description: t.Optional(t.String({ maxLength: 1000 })),
  pageCount: t.Numeric({ minimum: 1, maximum: 20000 }),
});

export const ebooksModule = new Elysia({ prefix: "/ebooks" })
  .use(authPlugin)
  .get("/", ({ user }) => listEbooks(user), { role: true })
  .post(
    "/",
    async ({ user, body, status }) => {
      const { maxEbookMb } = await getSettings();
      if (body.file.size > maxEbookMb * MB) return status(413, { message: `Ukuran e-book maksimal ${maxEbookMb} MB` });
      // trust the bytes, not the declared MIME type
      const kind = await fileTypeFromBuffer(await body.file.slice(0, 4100).arrayBuffer());
      if (kind?.mime !== "application/pdf") return status(422, { message: "Berkas harus berformat PDF" });
      let cover: { file: File; mime: string } | undefined;
      if (body.cover) {
        const c = await fileTypeFromBuffer(await body.cover.slice(0, 4100).arrayBuffer());
        if (!c || !COVER_TYPES.includes(c.mime)) return status(422, { message: "Sampul harus PNG, JPG, atau WebP" });
        cover = { file: body.cover, mime: c.mime };
      }
      return createEbook(user, { title: body.title.trim(), description: (body.description ?? "").trim(), pageCount: body.pageCount, file: body.file, cover });
    },
    { role: UPLOADERS, body: upload },
  )
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      const book = id ? await getEbook(user, id) : null;
      return book ?? status(404, notFound);
    },
    { role: true },
  )
  .get(
    "/:id/file",
    async ({ params, request, status }) => {
      const id = idOf(params.id);
      const file = id ? pdfFile(id) : null;
      if (!file || !(await file.exists())) return status(404, notFound);
      // sandbox/nosniff: the PDF is data for pdf.js; if someone opens the URL directly nothing in it can run
      return serveFile(file, request.headers.get("range"), {
        "content-type": "application/pdf",
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      });
    },
    { role: true },
  )
  .get(
    "/:id/cover",
    async ({ params, status }) => {
      const id = idOf(params.id);
      if (!id || !(await hasCover(id))) return status(404, notFound);
      const file = coverFile(id);
      if (!(await file.exists())) return status(404, notFound);
      return new Response(file, { headers: { "content-type": (await fileTypeFromBuffer(await file.slice(0, 4100).arrayBuffer()))?.mime ?? "image/jpeg", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
    },
    { role: true },
  )
  .put(
    "/:id/progress",
    async ({ user, params, body, status }) => {
      const id = idOf(params.id);
      return id && (await saveProgress(user, id, body.page)) ? { ok: true } : status(404, notFound);
    },
    { role: true, body: t.Object({ page: t.Integer({ minimum: 1, maximum: 20000 }) }) },
  )
  .delete(
    "/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      const r = id ? await deleteEbook(user, id) : "notfound";
      if (r === "notfound") return status(404, notFound);
      if (r === "forbidden") return status(403, { message: "Hanya pengunggah, admin, atau operator yang dapat menghapus" });
      return { ok: true };
    },
    { role: true },
  );
