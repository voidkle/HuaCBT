import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../../db";
import { appSettings, type ClassSystem } from "../../db/schema";
import { uploadDir } from "../../storage";

export const defaults = {
  siteTitle: "HuaEBL",
  copyrightHolder: "huacbt",
  maxVideoMb: 500,
  maxPptMb: 50,
  maxEbookMb: 100,
  maxChatMediaMb: 20,
  maxAssignmentMb: 20,
  // school structure: one mode for every class (see modules/classes). Moving class = lessons may send the class to a room
  classSystem: "subject_teachers" as ClassSystem,
  movingClass: false,
  biometricsEnabled: false,
  // presence: where the school is. Check-ins farther than the radius are refused; null = no location check
  schoolLat: null as number | null,
  schoolLng: null as number | null,
  schoolRadiusM: 150,
  aiSummaryEnabled: false,
  // ponytail: stored in plain text; encrypt at rest (key from env) if the DB is shared beyond admins
  aiApiKey: "",
  // video: speech-to-text and the summary model. Both speak the OpenAI-compatible HTTP API, so each can be OpenAI itself
  // or a self-hosted server (faster-whisper / Ollama / LocalAI...). Only admin and operator can change these URLs.
  transcriptionEnabled: false,
  transcriptionBaseUrl: "https://api.openai.com/v1",
  transcriptionModel: "whisper-1",
  transcriptionLanguage: "id",
  transcriptionApiKey: "", // write-only, like aiApiKey
  aiBaseUrl: "https://api.openai.com/v1",
  aiModel: "gpt-4o-mini",
  // logo bookkeeping, not editable through PATCH
  logoVersion: 0, // 0 = no custom logo; bumped on every change so URLs bust caches
  logoType: "",
};
export type Settings = typeof defaults;
export type EditableSettings = Omit<Settings, "logoVersion" | "logoType">;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(appSettings);
  const out: Record<string, unknown> = { ...defaults };
  for (const r of rows) if (r.key in defaults) out[r.key] = r.value;
  return out as Settings;
}

export async function updateSettings(patch: Partial<Settings>) {
  const rows = Object.entries(patch)
    .filter(([key, value]) => key in defaults && value !== undefined)
    .map(([key, value]) => ({ key, value: value === null ? sql`'null'::jsonb` : value })); // a bare null would be SQL NULL, not JSON null
  if (rows.length === 0) return;
  await db
    .insert(appSettings)
    .values(rows)
    .onConflictDoUpdate({ target: appSettings.key, set: { value: sql`excluded.value`, updatedAt: sql`now()` } });
}

/** What anyone (even signed-out visitors on the login page) may see. */
export const toPublic = (s: Settings) => ({
  siteTitle: s.siteTitle,
  copyrightHolder: s.copyrightHolder,
  maxEbookMb: s.maxEbookMb,
  maxChatMediaMb: s.maxChatMediaMb,
  maxAssignmentMb: s.maxAssignmentMb,
  maxVideoMb: s.maxVideoMb,
  maxPptMb: s.maxPptMb,
  // lets the UI enable or explain the transcript / summary buttons up front (no secrets here)
  transcriptionEnabled: s.transcriptionEnabled,
  aiSummaryEnabled: s.aiSummaryEnabled,
  classSystem: s.classSystem,
  movingClass: s.movingClass,
  // presence: the UI needs these two flags, never the coordinates
  biometricsEnabled: s.biometricsEnabled,
  locationRequired: s.schoolLat !== null && s.schoolLng !== null,
  logoUrl: s.logoVersion > 0 ? `/config/logo?v=${s.logoVersion}` : null,
});

/** Admin/operator view: never includes the AI key, only whether one is set. */
export const toAdmin = (s: Settings) => {
  const { aiApiKey, transcriptionApiKey, logoVersion: _v, logoType: _t, ...rest } = s;
  return { ...rest, ...toPublic(s), aiApiKeySet: aiApiKey !== "", transcriptionApiKeySet: transcriptionApiKey !== "" };
};

const logoPath = join(uploadDir, "logo");

export async function saveLogo(file: File, mime: string, current: number) {
  await mkdir(uploadDir, { recursive: true });
  await Bun.write(logoPath, file);
  await updateSettings({ logoType: mime, logoVersion: current + 1 });
}

export async function removeLogo() {
  await rm(logoPath, { force: true });
  await updateSettings({ logoType: "", logoVersion: 0 });
}

export const logoFile = () => Bun.file(logoPath);
