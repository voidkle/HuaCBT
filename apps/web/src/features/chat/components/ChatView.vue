<script setup lang="ts">
import { ref } from "vue";
import { MessagesSquare } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "../stores/useChatStore";
import type { Room } from "../types";
import ConversationView from "./ConversationView.vue";
import NewChatDialog from "./NewChatDialog.vue";
import RoomList from "./RoomList.vue";

interface Props {
  /** From the route: /chat shows only the list (and an empty pane on wide screens), /chat/:id opens a room. */
  roomId: number | null;
}
defineProps<Props>();

const auth = useAuthStore();
const chat = useChatStore();
const router = useRouter();
const newChatOpen = ref(false);

const openRoom = (room: Room) => router.push(`/chat/${room.id}`);
</script>

<template>
  <div class="flex h-[calc(100svh-9.5rem)] min-h-[420px] gap-3">
    <section class="bg-card w-full shrink-0 overflow-hidden rounded-xl border md:w-80" :class="roomId ? 'hidden md:block' : 'block'" aria-label="Obrolan">
      <RoomList :rooms="chat.sortedRooms" :active-id="roomId" :my-id="auth.user?.id" :loading="!chat.loaded" :error="chat.error" @new-chat="newChatOpen = true" @retry="chat.load" />
    </section>

    <section class="bg-card min-w-0 flex-1 overflow-hidden rounded-xl border" :class="roomId ? 'block' : 'hidden md:block'" aria-label="Percakapan">
      <ConversationView v-if="roomId" :key="roomId" :room-id="roomId" />
      <div v-else class="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MessagesSquare class="size-8" />
        <p class="text-sm">Pilih obrolan atau mulai yang baru.</p>
      </div>
    </section>

    <NewChatDialog v-model:open="newChatOpen" @created="openRoom" />
  </div>
</template>
