<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import type { Message } from "../types";
import MessageBubble from "./MessageBubble.vue";

interface Props {
  messages: Message[];
  myId: number | undefined;
  isGroup: boolean;
  canDelete: (m: Message) => boolean;
  hasMore: boolean;
  loadingOlder: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ "load-older": []; delete: [message: Message] }>();

const scroller = ref<HTMLElement | null>(null);
const content = ref<HTMLElement | null>(null);

const NEAR_BOTTOM_PX = 80;
const LOAD_OLDER_PX = 160;

/** True while the reader is at (or near) the newest message: new content then keeps the view pinned to the bottom. */
let stick = true;
/** Older messages are only fetched after the first jump to the newest one. */
let ready = false;
let resizeObserver: ResizeObserver | null = null;

const startsRun = (i: number) => props.messages[i]?.sender?.id !== props.messages[i - 1]?.sender?.id;

const toBottom = () => {
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
};

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  stick = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  if (ready && el.scrollTop < LOAD_OLDER_PX && props.hasMore && !props.loadingOlder) emit("load-older");
}

// new messages: stay pinned if the reader was at the bottom (or just sent one); older ones prepended: hold the position
watch(
  () => [props.messages[0]?.id, props.messages.at(-1)?.id] as const,
  async ([firstId, lastId], [prevFirstId, prevLastId]) => {
    const el = scroller.value;
    if (!el || prevFirstId === undefined) return;
    const prevHeight = el.scrollHeight;
    const mine = props.messages.at(-1)?.sender?.id === props.myId;
    await nextTick();
    if (firstId !== prevFirstId && lastId === prevLastId) el.scrollTop += el.scrollHeight - prevHeight; // older messages prepended
    else if (stick || mine) toBottom();
  },
  { flush: "pre" },
);

onMounted(async () => {
  await nextTick();
  toBottom();
  requestAnimationFrame(() => (ready = true));
  // images, video posters and covers finish loading after the first paint and make the list taller
  if (content.value) {
    resizeObserver = new ResizeObserver(() => stick && toBottom());
    resizeObserver.observe(content.value);
  }
});
onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <div ref="scroller" class="flex-1 overflow-y-auto overscroll-contain px-3 py-3" role="log" aria-live="polite" aria-label="Pesan" @scroll.passive="onScroll">
    <div class="flex h-6 items-center justify-center">
      <Loader2 v-if="loadingOlder" class="text-muted-foreground size-4 animate-spin" />
    </div>
    <div ref="content" class="flex flex-col gap-1">
      <div v-for="(m, i) in messages" :key="m.id" :class="{ 'mt-2': startsRun(i) }">
        <MessageBubble :message="m" :mine="m.sender?.id === myId" :show-sender="isGroup && m.sender?.id !== myId && startsRun(i)" :can-delete="canDelete(m)" @delete="emit('delete', $event)" />
      </div>
    </div>
  </div>
</template>
