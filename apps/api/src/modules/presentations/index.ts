import { fileTypeFromBuffer } from "file-type";
import { Elysia, t } from "elysia";
import { serveFile } from "../../http/serveFile";
import { authPlugin } from "../../plugins/auth";
import { getSettings } from "../config/service";
import { coverFile, deckFile } from "./paths";
import { createFromFile, createFromLink, deletePresentation, getPresentation, listPresentations, saveProgress, UPLOADERS } from "./service";

const MB = 1024 * 1024;
const idOf = (raw: string) => (/^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null); // ponytail: no `params` schema (Elysia 1.4.32 + Bun)
const notFound = { message: "Presentasi tidak ditemukan" };

/** What LibreOffice can convert and we accept. The bytes decide, not the file name (except legacy .ppt, whose signature is the generic OLE one). */
async function detectExt(file: File): Promise<"pptx" | "ppt" | "odp" | null> {
  const kind = await fileTypeFromBuffer(await file.slice(0, 4100).arrayBuffer());
  if (kind?.mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (kind?.mime === "application/vnd.oasis.opendocument.presentation") return "odp";
  if (kind?.mime === "application/x-cfb" && /\.ppt$/i.test(file.name)) return "ppt";
  return null;
}

const create = t.Object({
  title: t.String({ minLength: 1, maxLength: 150, pattern: "\\S" }),
  description: t.Optional(t.String({ maxLength: 1000 })),
  file: t.Optional(t.File()), // size is checked against the configurable limit in the handler
  link: t.Optional(t.String({ maxLength: 500 })),
});

export const presentationsModule = new Elysia({ prefix: "/presentations" })
  .use(authPlugin)
  .get("/", ({ user }) => listPresentations(user), { role: true })
  .post(
    "/",
    async ({ user, body, status }) => {
      const title = body.title.trim();
      const description = (body.description ?? "").trim();
      if (!!body.file === !!body.link?.trim()) return status(422, { message: "Pilih satu: unggah berkas presentasi atau isi tautan Google Slides/Canva" });
      if (body.link) {
        const r = await createFromLink(user, { title, description, link: body.link });
        return r.ok ? (await getPresentation(user, r.id))! : status(r.code, { message: r.message });
      }
      const file = body.file!;
      const { maxPptMb } = await getSettings();
      if (file.size > maxPptMb * MB) return status(413, { message: `Ukuran presentasi maksimal ${maxPptMb} MB` });
      const ext = await detectExt(file);
      if (!ext) return status(422, { message: "Berkas harus berformat PowerPoint (.pptx, .ppt) atau OpenDocument (.odp)" });
      return (await getPresentation(user, await createFromFile(user, { title, description, file, ext })))!;
    },
    { role: UPLOADERS, body: create },
  )
  .get(
    "/:id",
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      return (id ? await getPresentation(user, id) : null) ?? status(404, notFound);
    },
    { role: true },
  )
  .get(
    "/:id/file",
    async ({ user, params, request, status }) => {
      const id = idOf(params.id);
      const p = id ? await getPresentation(user, id) : null;
      const file = p && p.status === "ready" && p.kind === "file" ? deckFile(p.id) : null;
      if (!file || !(await file.exists())) return status(404, notFound);
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
    async ({ user, params, status }) => {
      const id = idOf(params.id);
      const p = id ? await getPresentation(user, id) : null;
      const file = p?.hasCover ? coverFile(p.id) : null;
      if (!file || !(await file.exists())) return status(404, notFound);
      return new Response(file, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" } });
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
      const r = id ? await deletePresentation(user, id) : "notfound";
      if (r === "notfound") return status(404, notFound);
      if (r === "forbidden") return status(403, { message: "Hanya pengunggah, admin, atau operator yang dapat menghapus" });
      return { ok: true };
    },
    { role: true },
  );
