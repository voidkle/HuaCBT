import { API_URL, api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { Presentation, PresentationInput } from "../types";

export const fetchPresentations = async () => unwrap<Presentation[]>(await api.presentations.get());
export const fetchPresentation = async (id: number) => unwrap<Presentation>(await api.presentations({ id }).get());
export const createPresentation = async (input: PresentationInput) =>
  unwrap<Presentation>(await api.presentations.post({ title: input.title, description: input.description, ...(input.file && { file: input.file }), ...(input.link && { link: input.link }) }));
export const deletePresentation = async (id: number) => unwrap<{ ok: true }>(await api.presentations({ id }).delete());
export const saveProgress = async (id: number, page: number) => unwrap<{ ok: true }>(await api.presentations({ id }).progress.put({ page }));
export const fetchMaxPptMb = async () => unwrap<{ maxPptMb: number }>(await api.config.public.get()).maxPptMb;

// URLs used directly by <img> and pdf.js (both send the session cookie)
export const fileUrl = (id: number) => `${API_URL}/presentations/${id}/file`;
export const coverUrl = (id: number) => `${API_URL}/presentations/${id}/cover`;
