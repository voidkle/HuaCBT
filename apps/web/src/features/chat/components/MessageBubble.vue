<script setup lang="ts">
import { MoreVertical, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { roleLabels } from "@/features/auth/types";
import { formatClock } from "@/utils/formatTime";
import type { Message } from "../types";
import AttachmentView from "./AttachmentView.vue";
import LinkEmbedCard from "./LinkEmbedCard.vue";

interface Props {
  message: Message;
  mine: boolean;
  /** Group chats label the first bubble of a run from someone else. */
  showSender: boolean;
  canDelete: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ delete: [message: Message] }>();
</script>

<template>
  <div class="group flex gap-1.5" :class="mine ? 'justify-end' : 'justify-start'">
    <div class="flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]" :class="mine ? 'items-end' : 'items-start'">
      <p v-if="showSender && message.sender" class="text-muted-foreground px-1 text-[11px]">{{ message.sender.name }} · {{ roleLabels[message.sender.role] }}</p>

      <div class="flex items-start gap-1" :class="{ 'flex-row-reverse': mine }">
        <div
          class="flex min-w-0 flex-col gap-1.5 rounded-2xl px-3 py-2 text-[13px]"
          :class="[mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm', message.deleted && 'italic opacity-70']"
        >
          <p v-if="message.deleted" class="text-xs">Pesan dihapus</p>
          <template v-else>
            <AttachmentView v-if="message.attachment" :attachment="message.attachment" />
            <LinkEmbedCard v-if="message.link" :link="message.link" class="text-foreground" />
            <p v-if="message.body" class="break-words whitespace-pre-wrap">{{ message.body }}</p>
          </template>
          <span class="self-end text-[10px] opacity-70">{{ formatClock(message.createdAt) }}</span>
        </div>

        <DropdownMenu v-if="canDelete && !message.deleted">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="text-muted-foreground size-6 shrink-0 opacity-60 group-hover:opacity-100 focus-visible:opacity-100" aria-label="Opsi pesan"><MoreVertical class="size-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent :align="mine ? 'end' : 'start'">
            <DropdownMenuItem class="text-destructive" @select="emit('delete', message)"><Trash2 />Hapus pesan</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </div>
</template>
