import { API_URL, api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { Ebook, EbookUploadInput } from "../types";

export const fetchEbooks = async () => unwrap<Ebook[]>(await api.ebooks.get());
export const fetchEbook = async (id: number) => unwrap<Ebook>(await api.ebooks({ id }).get());
export const uploadEbook = async (input: EbookUploadInput) => unwrap<Ebook>(await api.ebooks.post(input));
export const deleteEbook = async (id: number) => unwrap<{ ok: true }>(await api.ebooks({ id }).delete());
export const saveProgress = async (id: number, page: number) => unwrap<{ ok: true }>(await api.ebooks({ id }).progress.put({ page }));
export const fetchMaxEbookMb = async () => unwrap<{ maxEbookMb: number }>(await api.config.public.get()).maxEbookMb;

// URLs used directly by <img> and pdf.js (both send the session cookie)
export const fileUrl = (id: number) => `${API_URL}/ebooks/${id}/file`;
export const coverUrl = (id: number) => `${API_URL}/ebooks/${id}/cover`;
