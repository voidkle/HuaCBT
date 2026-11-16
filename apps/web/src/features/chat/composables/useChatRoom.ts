import { onBeforeUnmount, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { onSocketMessage, onSocketOpen } from "@/services/socketClient";
import * as chatApi from "../services/chatApi";
import { useChatStore } from "../stores/useChatStore";
import { type Message, PAGE_SIZE, type SendInput, type ServerEvent } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

/** One open conversation: history, live updates (de-duplicated by message id), sending and read marks. */
export function useChatRoom(roomId: number) {
  const chat = useChatStore();
  const toast = useToast();

  const messages = ref<Message[]>([]);
  const loading = ref(true);
  const loadingOlder = ref(false);
  const hasMore = ref(false);
  const error = ref<string | null>(null);
  const sending = ref(false);

  /** Adds or updates messages by id (the sender gets their own message from the HTTP reply AND from the socket). */
  function merge(incoming: Message[]) {
    const byId = new Map(messages.value.map((m) => [m.id, m]));
    for (const m of incoming) byId.set(m.id, m);
    messages.value = [...byId.values()].sort((a, b) => a.id - b.id);
  }

  async function loadLatest(initial: boolean) {
    try {
      const page = await chatApi.fetchMessages(roomId, { limit: PAGE_SIZE });
      merge(page.messages);
      if (initial) hasMore.value = page.hasMore;
      error.value = null;
    } catch (e) {
      if (initial) error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  async function loadOlder() {
    const oldest = messages.value[0];
    if (!oldest || loadingOlder.value || !hasMore.value) return;
    loadingOlder.value = true;
    try {
      const page = await chatApi.fetchMessages(roomId, { before: oldest.id, limit: PAGE_SIZE });
      merge(page.messages);
      hasMore.value = page.hasMore;
    } catch (e) {
      toast.error(message(e));
    } finally {
      loadingOlder.value = false;
    }
  }

  async function send(input: SendInput): Promise<boolean> {
    sending.value = true;
    try {
      merge([await chatApi.sendMessage(roomId, input)]);
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      sending.value = false;
    }
  }

  async function remove(id: number): Promise<boolean> {
    try {
      await chatApi.deleteMessage(id);
      markDeleted(id);
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    }
  }

  const markDeleted = (id: number) => {
    messages.value = messages.value.map((m) => (m.id === id ? { ...m, deleted: true, body: "", attachment: null, link: null } : m));
  };

  // --- read marks: only while this room is open AND the tab is visible
  let readTimer: ReturnType<typeof setTimeout> | undefined;
  function markReadSoon() {
    clearTimeout(readTimer);
    readTimer = setTimeout(async () => {
      if (document.visibilityState !== "visible") return;
      chat.clearUnread(roomId);
      try {
        await chatApi.markRead(roomId);
      } catch {
        /* the next message or focus retries */
      }
    }, 400);
  }

  function onEvent(data: unknown) {
    const event = data as ServerEvent;
    if (event.t === "message" && event.roomId === roomId) {
      merge([event.message]);
      markReadSoon();
    } else if (event.t === "deleted" && event.roomId === roomId) {
      markDeleted(event.messageId);
    }
  }

  let offMessage: (() => void) | null = null;
  let offOpen: (() => void) | null = null;
  const onVisible = () => document.visibilityState === "visible" && markReadSoon();

  onMounted(async () => {
    chat.setActive(roomId);
    chat.clearUnread(roomId);
    offMessage = onSocketMessage(onEvent);
    offOpen = onSocketOpen(() => !loading.value && void loadLatest(false)); // after a reconnect, fetch what arrived while the socket was down (the initial load covers the first connect)
    document.addEventListener("visibilitychange", onVisible);
    await loadLatest(true);
    markReadSoon();
  });

  onBeforeUnmount(() => {
    offMessage?.();
    offOpen?.();
    document.removeEventListener("visibilitychange", onVisible);
    clearTimeout(readTimer);
    if (chat.activeRoomId === roomId) chat.setActive(null);
  });

  return { messages, loading, loadingOlder, hasMore, error, sending, loadOlder, send, remove, reload: () => loadLatest(true) };
}
