import { fileTypeFromBuffer } from "file-type";
import { Elysia, t } from "elysia";
import { classSystems } from "../../db/schema";
import { authPlugin } from "../../plugins/auth";
import { classSwitchProblem } from "../classes/service";
import { getSettings, logoFile, removeLogo, saveLogo, toAdmin, toPublic, updateSettings } from "./service";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"]; // no SVG: it can carry scripts
const mb = t.Integer({ minimum: 1, maximum: 10240 });
const url = t.String({ maxLength: 300, pattern: "^https?://[^\\s]+$" }); // base URL of an OpenAI-compatible API
// every field optional (partial update); unknown keys (e.g. the logo bookkeeping ones) are rejected
const editable = t.Object(
  {
    siteTitle: t.Optional(t.String({ minLength: 1, maxLength: 60 })),
    copyrightHolder: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
    maxVideoMb: t.Optional(mb),
    maxPptMb: t.Optional(mb),
    maxEbookMb: t.Optional(mb),
    maxChatMediaMb: t.Optional(mb),
    maxAssignmentMb: t.Optional(mb),
    classSystem: t.Optional(t.UnionEnum([...classSystems])),
    movingClass: t.Optional(t.Boolean()),
    biometricsEnabled: t.Optional(t.Boolean()),
    schoolLat: t.Optional(t.Nullable(t.Number({ minimum: -90, maximum: 90 }))), // null clears the location
    schoolLng: t.Optional(t.Nullable(t.Number({ minimum: -180, maximum: 180 }))),
    schoolRadiusM: t.Optional(t.Integer({ minimum: 20, maximum: 5000 })),
    aiSummaryEnabled: t.Optional(t.Boolean()),
    aiApiKey: t.Optional(t.String({ maxLength: 300 })), // "" clears the key
    transcriptionEnabled: t.Optional(t.Boolean()),
    transcriptionBaseUrl: t.Optional(url),
    transcriptionModel: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
    transcriptionLanguage: t.Optional(t.String({ maxLength: 10, pattern: "^([a-z]{2,3}(-[A-Za-z]{2,4})?)?$" })), // "" = let the model detect
    transcriptionApiKey: t.Optional(t.String({ maxLength: 300 })), // "" clears the key
    aiBaseUrl: t.Optional(url),
    aiModel: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  },
  { additionalProperties: false },
);

const MANAGERS = ["admin", "operator"] as const;

const adminView = async () => toAdmin(await getSettings());

export const configModule = new Elysia({ prefix: "/config" })
  .use(authPlugin)
  .get("/public", async () => toPublic(await getSettings()))
  .get("/logo", async ({ status, set }) => {
    const s = await getSettings();
    const file = logoFile();
    if (s.logoVersion === 0 || !(await file.exists())) return status(404, { message: "No logo" });
    set.headers["content-type"] = s.logoType;
    set.headers["cache-control"] = "public, max-age=31536000, immutable"; // URL carries ?v=<version>
    set.headers["x-content-type-options"] = "nosniff";
    return file;
  })
  .get("/", adminView, { role: MANAGERS })
  .patch(
    "/",
    async ({ body, status }) => {
      if (body.classSystem && body.classSystem !== (await getSettings()).classSystem) {
        const problem = await classSwitchProblem(body.classSystem);
        if (problem) return status(409, { message: problem });
      }
      await updateSettings(body);
      return adminView();
    },
    { role: MANAGERS, body: editable },
  )
  .post(
    "/logo",
    async ({ body, status }) => {
      // trust the bytes, not the client-declared MIME type
      const detected = await fileTypeFromBuffer(await body.file.arrayBuffer());
      if (!detected || !LOGO_TYPES.includes(detected.mime)) return status(422, { message: "Logo harus PNG, JPG, atau WebP" });
      await saveLogo(body.file, detected.mime, (await getSettings()).logoVersion);
      return adminView();
    },
    { role: MANAGERS, body: t.Object({ file: t.File({ maxSize: "1m" }) }) },
  )
  .delete(
    "/logo",
    async () => {
      await removeLogo();
      return adminView();
    },
    { role: MANAGERS },
  );
