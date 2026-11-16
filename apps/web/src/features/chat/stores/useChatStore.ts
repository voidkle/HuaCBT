import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { connectSocket, disconnectSocket, onSocketMessage, onSocketOpen } from "@/services/socketClient";
import * as chatApi from "../services/chatApi";
import type { Message, Room, ServerEvent } from "../types";

/** Rooms and unread counts for the whole app (the sidebar badge lives on every page). Message lists live in useChatRoom. */
export const useChatStore = defineStore("chat", () => {
  const auth = useAuthStore();

  const rooms = ref<Room[]>([]);
  const loaded = ref(false);
  const error = ref<string | null>(null);
  /** The room currently open and visible, so its new messages are read immediately. */
  const activeRoomId = ref<number | null>(null);

  // timestamps arrive as Date (Eden parses ISO strings from REST) or string (WebSocket events): compare as numbers
  const time = (t: string | Date | null) => (t ? new Date(t).getTime() : 0);
  const sortedRooms = computed(() => [...rooms.value].sort((a, b) => time(b.lastMessageAt) - time(a.lastMessageAt) || b.id - a.id));
  const totalUnread = computed(() => rooms.value.reduce((sum, r) => sum + r.unread, 0));

  async function load() {
    try {
      rooms.value = await chatApi.fetchRooms();
      error.value = null;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Gagal memuat chat";
    } finally {
      loaded.value = true;
    }
  }

  function upsertRoom(room: Room) {
    const i = rooms.value.findIndex((r) => r.id === room.id);
    if (i === -1) rooms.value = [room, ...rooms.value];
    else rooms.value = rooms.value.map((r) => (r.id === room.id ? { ...room, unread: r.unread } : r));
  }

  const setActive = (roomId: number | null) => {
    activeRoomId.value = roomId;
  };
  const clearUnread = (roomId: number) => {
    rooms.value = rooms.value.map((r) => (r.id === roomId && r.unread ? { ...r, unread: 0 } : r));
  };

  function onMessage(roomId: number, message: Message) {
    const room = rooms.value.find((r) => r.id === roomId);
    if (!room) return void load(); // a room we have not seen yet: the `room` event may trail the first message
    const mine = message.sender?.id === auth.user?.id;
    const reading = activeRoomId.value === roomId && document.visibilityState === "visible";
    rooms.value = rooms.value.map((r) =>
      r.id === roomId
        ? { ...r, lastMessageAt: message.createdAt, lastMessage: { id: message.id, senderId: message.sender?.id ?? null, preview: previewOf(message), createdAt: message.createdAt }, unread: mine || reading ? r.unread : r.unread + 1 }
        : r,
    );
  }

  function handle(data: unknown) {
    const event = data as ServerEvent;
    if (event.t === "room") upsertRoom(event.room);
    else if (event.t === "message") onMessage(event.roomId, event.message);
    else if (event.t === "deleted") void load(); // previews and unread counts may change: cheap to re-sync
  }

  // listeners are registered by start() and removed by stop(): the AppShell owns that lifecycle
  let offMessage: (() => void) | null = null;
  let offOpen: (() => void) | null = null;

  async function start() {
    if (offMessage) return;
    offMessage = onSocketMessage(handle);
    offOpen = onSocketOpen(() => void load()); // after a reconnect, catch up on rooms and unread counts
    connectSocket();
    await load();
  }

  function stop() {
    offMessage?.();
    offOpen?.();
    offMessage = offOpen = null;
    disconnectSocket();
  }

  return { rooms, sortedRooms, totalUnread, loaded, error, activeRoomId, load, upsertRoom, setActive, clearUnread, start, stop };
});

function previewOf(m: Message): string {
  if (m.deleted) return "Pesan dihapus";
  if (m.body.trim()) return m.body.trim().slice(0, 100);
  if (m.attachment) return { image: "Gambar", video: "Video", audio: "Audio", file: `Berkas: ${m.attachment.name}` }[m.attachment.kind];
  return m.link ? { video: "Tautan video", slide: "Tautan presentasi", ebook: "Tautan e-book" }[m.link.type] : "";
}
