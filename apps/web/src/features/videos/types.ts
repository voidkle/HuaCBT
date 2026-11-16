import type { Role } from "@/features/auth/types";

/** Eden parses ISO strings into Date for REST responses; accept both. */
export type Ts = string | Date;

export type VideoStatus = "uploading" | "ready" | "failed";
export type Approval = "pending" | "approved" | "rejected";
export type JobStatus = "none" | "queued" | "processing" | "ready" | "failed";

export interface VideoSummary {
  id: number;
  title: string;
  description: string;
  status: VideoStatus;
  approval: Approval;
  reviewNote: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  hasPoster: boolean;
  createdAt: Ts;
  transcriptStatus: JobStatus;
  summaryStatus: JobStatus;
  failureReason: string | null;
  /** The signed-in user's last position, or null if they never watched. */
  progressSec: number | null;
  uploader: { id: number; name: string; role: Role } | null;
}

export interface Chapter {
  start: number;
  title: string;
}

export interface VideoDetail extends VideoSummary {
  transcriptSource: "auto" | "manual" | null;
  transcriptError: string | null;
  summary: { text: string; chapters: Chapter[] } | null;
  summaryError: string | null;
  originalName: string;
}

export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

/** What the public config says about video features (no secrets). */
export interface VideoFeatureFlags {
  maxVideoMb: number;
  transcriptionEnabled: boolean;
  aiSummaryEnabled: boolean;
}

export const ACCEPTED_TYPES = ["video/mp4", "video/webm"] as const;
export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
