import { API_URL, api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { Cue, VideoDetail, VideoFeatureFlags, VideoSummary } from "../types";

export const fetchVideos = async () => unwrap<VideoSummary[]>(await api.videos.get());
export const fetchVideo = async (id: number) => unwrap<VideoDetail>(await api.videos({ id }).get());
export const updateVideo = async (id: number, meta: { title: string; description: string }) => unwrap<true>(await api.videos({ id }).patch(meta));
export const deleteVideo = async (id: number) => unwrap<true>(await api.videos({ id }).delete());
export const approveVideo = async (id: number) => unwrap<true>(await api.videos({ id }).approve.post());
export const rejectVideo = async (id: number, note?: string) => unwrap<true>(await api.videos({ id }).reject.post({ note }));
export const saveProgress = async (id: number, position: number) => unwrap<true>(await api.videos({ id }).progress.put({ position }));

export const fetchCues = async (id: number) => unwrap<Cue[]>(await api.videos({ id }).transcript.get());
export const startTranscript = async (id: number) => unwrap<true>(await api.videos({ id }).transcript.post());
export const clearTranscript = async (id: number) => unwrap<true>(await api.videos({ id }).transcript.delete());
export const uploadCaptions = async (id: number, content: string) => unwrap<{ cues: number }>(await api.videos({ id }).captions.put({ content }));
export const startSummary = async (id: number) => unwrap<true>(await api.videos({ id }).summary.post());

export async function fetchVideoFlags(): Promise<VideoFeatureFlags> {
  const c = unwrap<VideoFeatureFlags>(await api.config.public.get());
  return { maxVideoMb: c.maxVideoMb, transcriptionEnabled: c.transcriptionEnabled, aiSummaryEnabled: c.aiSummaryEnabled };
}

// plain URLs: <video>, <track> and <img> send the session cookie themselves
export const fileUrl = (id: number) => `${API_URL}/videos/${id}/file`;
export const posterUrl = (id: number) => `${API_URL}/videos/${id}/poster`;
export const captionsUrl = (id: number, version = 0) => `${API_URL}/videos/${id}/captions.vtt?v=${version}`;
