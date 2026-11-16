<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2, Search, Send } from "lucide-vue-next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { initials } from "@/utils/initials";
import { sendMessage } from "../services/chatApi";
import { linkPositionLabel } from "../services/linkTarget";
import { roomTitle } from "../services/roomLabels";
import { useChatStore } from "../stores/useChatStore";
import type { LinkTarget, Room } from "../types";

interface Props {
  /** What is being shared: the resource, the position inside it, and its title for display. */
  link: (LinkTarget & { title: string }) | null;
}
const props = defineProps<Props>();
const open = defineModel<boolean>("open", { required: true });

const chat = useChatStore();
const auth = useAuthStore();
const toast = useToast();

const note = ref("");
const filter = ref("");
const sendingTo = ref<number | null>(null);

// this dialog is also used on the full-screen reader, outside the app shell: it loads the rooms itself
watch(open, (isOpen) => {
  if (!isOpen) return;
  note.value = "";
  filter.value = "";
  void chat.load();
});

const visible = computed(() => {
  const q = filter.value.trim().toLowerCase();
  return chat.sortedRooms.filter((r) => !q || roomTitle(r, auth.user?.id).toLowerCase().includes(q));
});

async function share(room: Room) {
  if (!props.link || sendingTo.value !== null) return;
  sendingTo.value = room.id;
  try {
    await sendMessage(room.id, { text: note.value.trim(), link: { type: props.link.type, ref: props.link.ref, page: props.link.page } });
    toast.success(`Terkirim ke ${roomTitle(room, auth.user?.id)}`);
    open.value = false;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Gagal mengirim");
  } finally {
    sendingTo.value = null;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Bagikan ke chat</DialogTitle>
        <DialogDescription v-if="link">{{ link.title }} · {{ linkPositionLabel(link) }}. Penerima langsung dibawa ke halaman ini.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-1.5">
        <Label for="share-note">Pesan (opsional)</Label>
        <Input id="share-note" v-model="note" maxlength="500" autocomplete="off" placeholder="Misalnya: baca halaman ini dulu" />
      </div>

      <div class="relative">
        <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input v-model="filter" placeholder="Cari chat…" class="pl-9" aria-label="Cari chat" autocomplete="off" />
      </div>

      <div class="min-h-24">
        <div v-if="!chat.loaded" class="flex justify-center py-6"><Loader2 class="text-muted-foreground size-5 animate-spin" /></div>
        <p v-else-if="chat.rooms.length === 0" class="text-muted-foreground py-6 text-center text-sm">Belum ada chat. Mulai percakapan dari halaman Chat dulu.</p>
        <p v-else-if="visible.length === 0" class="text-muted-foreground py-6 text-center text-sm">Tidak ada chat yang cocok.</p>
        <ul v-else class="flex max-h-60 flex-col gap-0.5 overflow-y-auto" aria-label="Pilih chat tujuan">
          <li v-for="r in visible" :key="r.id">
            <button type="button" class="hover:bg-accent flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors" :disabled="sendingTo !== null" @click="share(r)">
              <Avatar class="size-8"><AvatarFallback class="bg-secondary text-secondary-foreground text-[11px]">{{ initials(roomTitle(r, auth.user?.id)) }}</AvatarFallback></Avatar>
              <span class="min-w-0 flex-1 truncate text-[13px] font-medium">{{ roomTitle(r, auth.user?.id) }}</span>
              <Loader2 v-if="sendingTo === r.id" class="size-4 animate-spin" />
              <Send v-else class="text-muted-foreground size-4" />
            </button>
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>
