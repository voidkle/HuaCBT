<script setup lang="ts">
import { RouterLink } from "vue-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatChatTime } from "@/utils/formatTime";
import { initials } from "@/utils/initials";
import { roomTitle } from "../services/roomLabels";
import type { Room } from "../types";

interface Props {
  room: Room;
  active: boolean;
  myId: number | undefined;
}
defineProps<Props>();
</script>

<template>
  <RouterLink
    :to="`/chat/${room.id}`"
    class="hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-lg p-2 outline-none focus-visible:ring-[3px]"
    :class="{ 'bg-accent': active }"
    :aria-current="active ? 'page' : undefined"
  >
    <Avatar class="size-9 shrink-0"><AvatarFallback class="bg-secondary text-secondary-foreground text-[11px]">{{ initials(roomTitle(room, myId)) }}</AvatarFallback></Avatar>
    <div class="flex min-w-0 flex-1 flex-col leading-tight">
      <div class="flex items-baseline gap-2">
        <span class="min-w-0 flex-1 truncate text-[13px]" :class="room.unread ? 'font-semibold' : 'font-medium'">{{ roomTitle(room, myId) }}</span>
        <span v-if="room.lastMessage" class="text-muted-foreground shrink-0 text-[11px]">{{ formatChatTime(room.lastMessage.createdAt) }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground min-w-0 flex-1 truncate text-xs" :class="{ 'text-foreground': room.unread }">{{ room.lastMessage?.preview ?? "Belum ada pesan" }}</span>
        <span v-if="room.unread" class="bg-primary text-primary-foreground min-w-5 shrink-0 rounded-full px-1.5 text-center text-[10px] leading-5 font-medium" :aria-label="`${room.unread} belum dibaca`">{{ room.unread > 99 ? "99+" : room.unread }}</span>
      </div>
    </div>
  </RouterLink>
</template>
