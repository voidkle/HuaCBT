<script setup lang="ts">
import { computed, ref } from "vue";
import { ArrowLeft, WifiOff } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { socketStatus } from "@/services/socketClient";
import { initials } from "@/utils/initials";
import { useChatRoom } from "../composables/useChatRoom";
import { roomSubtitle, roomTitle } from "../services/roomLabels";
import { useChatStore } from "../stores/useChatStore";
import type { Message } from "../types";
import ChatComposer from "./ChatComposer.vue";
import MessageList from "./MessageList.vue";

interface Props {
  roomId: number;
}
const props = defineProps<Props>();

const auth = useAuthStore();
const chat = useChatStore();
const { messages, loading, loadingOlder, hasMore, error, sending, loadOlder, send, remove, reload } = useChatRoom(props.roomId);

const room = computed(() => chat.rooms.find((r) => r.id === props.roomId) ?? null);
const title = computed(() => (room.value ? roomTitle(room.value, auth.user?.id) : ""));
const subtitle = computed(() => (room.value ? roomSubtitle(room.value, auth.user?.id) : ""));
const offline = computed(() => socketStatus.value !== "open");

const canDelete = (m: Message) => !m.deleted && (m.sender?.id === auth.user?.id || auth.hasRole("admin", "operator"));
const deleting = ref<Message | null>(null);
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-2 md:px-3">
      <Button as-child variant="ghost" size="icon" class="md:hidden" aria-label="Kembali ke daftar obrolan"><RouterLink to="/chat"><ArrowLeft class="size-4" /></RouterLink></Button>
      <Avatar v-if="room" class="size-8"><AvatarFallback class="bg-secondary text-secondary-foreground text-[11px]">{{ initials(title) }}</AvatarFallback></Avatar>
      <Skeleton v-else class="size-8 rounded-full" />
      <div class="flex min-w-0 flex-col leading-tight">
        <h2 class="truncate text-[13px] font-medium">{{ title || "Memuat…" }}</h2>
        <p class="text-muted-foreground truncate text-[11px]">{{ subtitle }}</p>
      </div>
    </header>

    <p v-if="offline" class="bg-muted text-muted-foreground flex items-center gap-1.5 px-3 py-1 text-xs" role="status"><WifiOff class="size-3" />Menyambung ulang… pesan baru muncul setelah tersambung.</p>

    <div v-if="loading" class="flex flex-1 flex-col gap-3 p-4" aria-busy="true">
      <Skeleton class="h-10 w-2/3 rounded-2xl" /><Skeleton class="ml-auto h-10 w-1/2 rounded-2xl" /><Skeleton class="h-10 w-3/5 rounded-2xl" />
    </div>

    <div v-else-if="error" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <div class="flex gap-2">
        <Button variant="outline" @click="reload">Coba lagi</Button>
        <Button as-child variant="outline"><RouterLink to="/chat">Kembali</RouterLink></Button>
      </div>
    </div>

    <template v-else>
      <p v-if="messages.length === 0" class="text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm">Belum ada pesan. Sapa duluan!</p>
      <MessageList v-else :messages="messages" :my-id="auth.user?.id" :is-group="room?.type === 'group'" :can-delete="canDelete" :has-more="hasMore" :loading-older="loadingOlder" @load-older="loadOlder" @delete="deleting = $event" />
      <ChatComposer :send="send" :sending="sending" />
    </template>

    <BaseConfirmDialog
      :open="deleting !== null"
      title="Hapus pesan?"
      description="Pesan ini akan hilang untuk semua anggota percakapan."
      @update:open="(v: boolean) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>
