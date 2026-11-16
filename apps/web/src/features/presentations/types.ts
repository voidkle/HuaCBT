export type PresentationKind = "file" | "google" | "canva";
export type PresentationStatus = "converting" | "ready" | "failed";

export interface Presentation {
  id: number;
  title: string;
  description: string;
  kind: PresentationKind;
  /** Canonical page of a Google Slides / Canva deck (null for uploaded files). */
  link: string | null;
  /** What the sandboxed iframe loads (links only). */
  embedUrl: string | null;
  status: PresentationStatus;
  failureReason: string | null;
  sizeBytes: number;
  /** Slides of an uploaded deck; null for links and until the conversion has finished. */
  pageCount: number | null;
  hasCover: boolean;
  createdAt: string;
  uploader: { id: number; name: string } | null;
  /** The signed-in user's last slide, or null. */
  progressPage: number | null;
}

/** Exactly one of `file` and `link`. */
export interface PresentationInput {
  title: string;
  description: string;
  file?: File;
  link?: string;
}

export const kindLabels: Record<PresentationKind, string> = { file: "Berkas", google: "Google Slides", canva: "Canva" };
export const ACCEPTED_EXTENSIONS = /\.(pptx|ppt|odp)$/i;

export type SlideTransition = "none" | "fade" | "slide" | "zoom";
export const TRANSITIONS: readonly { value: SlideTransition; label: string }[] = [
  { value: "slide", label: "Geser" },
  { value: "fade", label: "Pudar" },
  { value: "zoom", label: "Zoom" },
  { value: "none", label: "Tanpa transisi" },
];
