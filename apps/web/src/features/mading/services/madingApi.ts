import { api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import type { Notice, NoticeInput } from "../types";

export const fetchNotices = async () => unwrap<Notice[]>(await api.mading.get());
export const createNotice = async (input: NoticeInput) => unwrap<Notice>(await api.mading.post(input));
export const updateNotice = async (id: number, input: NoticeInput) => unwrap<Notice>(await api.mading({ id }).patch(input));
export const deleteNotice = async (id: number) => unwrap<{ ok: true }>(await api.mading({ id }).delete());
export const approveNotice = async (id: number) => unwrap<Notice>(await api.mading({ id }).approve.post());
export const rejectNotice = async (id: number, note?: string) => unwrap<Notice>(await api.mading({ id }).reject.post({ note }));
