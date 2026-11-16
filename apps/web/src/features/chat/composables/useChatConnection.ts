import { onBeforeUnmount, onMounted } from "vue";
import { useChatStore } from "../stores/useChatStore";

/** Keeps the live connection open while the app shell is mounted (signed-in pages). */
export function useChatConnection() {
  const chat = useChatStore();
  onMounted(() => void chat.start());
  onBeforeUnmount(() => chat.stop());
}
