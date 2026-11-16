<script setup lang="ts">
import { MessageSquarePlus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Room } from "../types";
import RoomListItem from "./RoomListItem.vue";

interface Props {
  rooms: Room[];
  activeId: number | null;
  myId: number | undefined;
  loading: boolean;
  error: string | null;
}
defineProps<Props>();
const emit = defineEmits<{ "new-chat": []; retry: [] }>();
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <h2 class="text-[13px] font-medium">Obrolan</h2>
      <Button variant="ghost" size="icon" class="text-muted-foreground ml-auto size-8" aria-label="Chat baru" title="Chat baru" @click="emit('new-chat')"><MessageSquarePlus class="size-4" /></Button>
    </div>

    <div v-if="loading" class="flex flex-col gap-2 p-2" aria-busy="true"><Skeleton v-for="i in 5" :key="i" class="h-12 rounded-lg" /></div>

    <div v-else-if="error" class="flex flex-col items-center gap-2 p-6 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" size="sm" @click="emit('retry')">Coba lagi</Button>
    </div>

    <div v-else-if="rooms.length === 0" class="flex flex-col items-center gap-3 p-6 text-center">
      <p class="text-muted-foreground text-sm">Belum ada obrolan.</p>
      <Button size="sm" @click="emit('new-chat')"><MessageSquarePlus />Mulai chat</Button>
    </div>

    <nav v-else class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5" aria-label="Daftar obrolan">
      <RoomListItem v-for="r in rooms" :key="r.id" :room="r" :active="r.id === activeId" :my-id="myId" />
    </nav>
  </div>
</template>
