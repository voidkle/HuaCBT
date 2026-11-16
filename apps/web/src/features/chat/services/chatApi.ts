import { API_URL, api } from "@/services/api";
import { unwrap } from "@/services/unwrap";
import { type Linkables, type Message, type Room, type SendInput } from "../types";
import type { ChatUser } from "../types";

export const fetchRooms = async () => unwrap<Room[]>(await api.chat.rooms.get());
export const openDirectRoom = async (userId: number) => unwrap<Room>(await api.chat.rooms.post({ type: "direct", userId }));
export const createGroup = async (name: string, memberIds: number[]) => unwrap<Room>(await api.chat.rooms.post({ type: "group", name, memberIds }));

export const fetchMessages = async (roomId: number, opts: { before?: number; limit?: number } = {}) => {
  const query: Record<string, string> = {};
  if (opts.before) query.before = String(opts.before);
  if (opts.limit) query.limit = String(opts.limit);
  return unwrap<{ messages: Message[]; hasMore: boolean }>(await api.chat.rooms({ id: roomId }).messages.get({ query }));
};

export const sendMessage = async (roomId: number, input: SendInput) =>
  unwrap<Message>(
    await api.chat.rooms({ id: roomId }).messages.post({
      text: input.text,
      file: input.file,
      ...(input.link && { linkType: input.link.type, linkRef: input.link.ref, linkPage: input.link.page }),
    }),
  );

export const markRead = async (roomId: number) => unwrap<{ ok: true }>(await api.chat.rooms({ id: roomId }).read.post());
export const deleteMessage = async (id: number) => unwrap<{ ok: true }>(await api.chat.messages({ id }).delete());
export const searchUsers = async (q: string) => unwrap<ChatUser[]>(await api.chat.users.get({ query: { q } }));
export const fetchLinkables = async () => unwrap<Linkables>(await api.chat.linkables.get());
export const fetchMaxChatMediaMb = async () => unwrap<{ maxChatMediaMb: number }>(await api.config.public.get()).maxChatMediaMb;

// URLs used directly by <img>, <video>, <audio> and <a> (they send the session cookie)
export const mediaUrl = (path: string) => `${API_URL}${path}`;
export const ebookCoverUrl = (ebookId: number) => `${API_URL}/ebooks/${ebookId}/cover`;
export const videoPosterUrl = (videoId: number) => `${API_URL}/videos/${videoId}/poster`;
export const slideCoverUrl = (deckId: number) => `${API_URL}/presentations/${deckId}/cover`;
export const coverUrlFor = (type: "ebook" | "video" | "slide", ref: number) => (type === "video" ? videoPosterUrl(ref) : type === "slide" ? slideCoverUrl(ref) : ebookCoverUrl(ref));
