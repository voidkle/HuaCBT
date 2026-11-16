/** Visible to everyone, including the login page. */
export interface PublicConfig {
  siteTitle: string;
  copyrightHolder: string;
  /** Path on the API (e.g. `/config/logo?v=3`), or null when no custom logo is set. */
  logoUrl: string | null;
}

/** Admin/operator view. The AI key is never sent back, only whether one is stored. */
export interface AppConfig extends PublicConfig {
  maxVideoMb: number;
  maxPptMb: number;
  maxEbookMb: number;
  maxChatMediaMb: number;
  maxAssignmentMb: number;
  /** School-wide: one teacher per class (SD) or a teacher per subject plus a wali kelas (SMP/SMA/SMK). */
  classSystem: "homeroom_teacher" | "subject_teachers";
  /** Lessons may send the class to a subject room. */
  movingClass: boolean;
  biometricsEnabled: boolean;
  schoolLat: number | null;
  schoolLng: number | null;
  schoolRadiusM: number;
  aiSummaryEnabled: boolean;
  aiApiKeySet: boolean;
  transcriptionEnabled: boolean;
  transcriptionBaseUrl: string;
  transcriptionModel: string;
  transcriptionLanguage: string;
  transcriptionApiKeySet: boolean;
  aiBaseUrl: string;
  aiModel: string;
}

/** The fields the form edits. `aiApiKey`: undefined = keep, "" = remove, otherwise replace. */
export interface ConfigDraft {
  siteTitle: string;
  copyrightHolder: string;
  maxVideoMb: number;
  maxPptMb: number;
  maxEbookMb: number;
  maxChatMediaMb: number;
  maxAssignmentMb: number;
  /** School-wide: one teacher per class (SD) or a teacher per subject plus a wali kelas (SMP/SMA/SMK). */
  classSystem: "homeroom_teacher" | "subject_teachers";
  /** Lessons may send the class to a subject room. */
  movingClass: boolean;
  biometricsEnabled: boolean;
  /** Presence only works within schoolRadiusM of this point; null = no location check. */
  schoolLat: number | null;
  schoolLng: number | null;
  schoolRadiusM: number;
  aiSummaryEnabled: boolean;
  aiApiKey?: string;
  transcriptionEnabled: boolean;
  transcriptionBaseUrl: string;
  transcriptionModel: string;
  transcriptionLanguage: string;
  /** Same convention as aiApiKey: undefined = keep, "" = remove. */
  transcriptionApiKey?: string;
  aiBaseUrl: string;
  aiModel: string;
}

export type ConfigPatch = Partial<ConfigDraft>;

export const LOGO_MAX_BYTES = 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
