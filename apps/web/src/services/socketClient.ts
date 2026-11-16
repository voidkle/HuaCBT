import { ref } from "vue";
import { API_URL } from "./api";

type Handler = (data: unknown) => void;

/** The single WebSocket of the app (live chat events). Created once here, never inside components. */
const handlers = new Set<Handler>();
const openHandlers = new Set<() => void>();

export const socketStatus = ref<"closed" | "connecting" | "open">("closed");

const HEARTBEAT_MS = 25_000; // keeps idle proxies from closing the connection
const MAX_BACKOFF_MS = 30_000;

let socket: WebSocket | null = null;
let wanted = false;
let attempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

const url = () => `${API_URL.replace(/^http/, "ws")}/chat/ws`;

function open() {
  const ws = new WebSocket(url());
  socket = ws;
  socketStatus.value = "connecting";

  ws.onopen = () => {
    attempt = 0;
    socketStatus.value = "open";
    heartbeatTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send("ping"), HEARTBEAT_MS);
    openHandlers.forEach((h) => h()); // consumers re-sync whatever they missed while disconnected
  };
  ws.onmessage = (e) => {
    if (e.data === "pong") return;
    try {
      const data: unknown = JSON.parse(String(e.data));
      handlers.forEach((h) => h(data));
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onerror = () => ws.close();
  ws.onclose = () => {
    clearInterval(heartbeatTimer);
    if (socket === ws) socket = null;
    socketStatus.value = "closed";
    if (wanted) {
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++) + Math.random() * 300; // backoff + jitter
      reconnectTimer = setTimeout(open, delay);
    }
  };
}

export function connectSocket() {
  wanted = true;
  if (!socket) open();
}

export function disconnectSocket() {
  wanted = false;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  socket?.close();
  socket = null;
  socketStatus.value = "closed";
}

/** Subscribes to parsed server events; returns the unsubscribe function (call it on unmount). */
export function onSocketMessage(handler: Handler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** Runs every time the socket (re)opens. Returns the unsubscribe function. */
export function onSocketOpen(handler: () => void): () => void {
  openHandlers.add(handler);
  return () => openHandlers.delete(handler);
}
