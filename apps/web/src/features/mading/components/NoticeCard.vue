<script setup lang="ts">
import { computed, ref } from "vue";
import { Calendar, Check, CircleX, Pencil, Trash2, X } from "lucide-vue-next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/features/auth/types";
import { formatDate } from "@/utils/formatDate";
import { initials } from "@/utils/initials";
import type { Notice, NoticePermissions } from "../types";

interface Props {
  notice: Notice;
  permissions: NoticePermissions;
  busy: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ edit: [notice: Notice]; remove: [notice: Notice]; approve: [notice: Notice]; reject: [notice: Notice] }>();

const CLAMP_AT = 160;
const expanded = ref(false);
const long = computed(() => props.notice.body.length > CLAMP_AT || props.notice.body.split("\n").length > 3);
const can = computed(() => ({
  edit: props.permissions.edit(props.notice),
  remove: props.permissions.remove(props.notice),
  approve: props.permissions.approve(props.notice),
  reject: props.permissions.reject(props.notice),
}));
const hasActions = computed(() => Object.values(can.value).some(Boolean));
</script>

<template>
  <article class="bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-xs">
    <div class="flex flex-col gap-1">
      <h3 class="text-[13px] leading-snug font-medium">{{ notice.title }}</h3>
      <p class="text-muted-foreground text-xs whitespace-pre-line" :class="{ 'line-clamp-3': !expanded }">{{ notice.body }}</p>
      <button v-if="long" type="button" class="text-foreground w-fit text-xs underline-offset-2 hover:underline" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ expanded ? "Ringkas" : "Selengkapnya" }}
      </button>
    </div>

    <p v-if="notice.status === 'rejected'" class="bg-muted flex gap-1.5 rounded-md p-2 text-xs">
      <CircleX class="text-destructive mt-0.5 size-3.5 shrink-0" />
      <span>{{ notice.reviewNote ? `Ditolak: ${notice.reviewNote}` : "Ditolak tanpa catatan." }}</span>
    </p>

    <div class="flex items-center gap-1.5">
      <Avatar class="size-5">
        <AvatarFallback class="bg-secondary text-secondary-foreground text-[9px]">{{ initials(notice.author.name) }}</AvatarFallback>
      </Avatar>
      <span class="min-w-0 truncate text-xs">{{ notice.author.name }}</span>
      <span class="text-muted-foreground shrink-0 text-xs">· {{ roleLabels[notice.author.role] }}</span>
      <span class="bg-muted text-muted-foreground ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]">
        <Calendar class="size-3" />{{ formatDate(notice.createdAt) }}
      </span>
    </div>

    <div v-if="hasActions" class="flex flex-wrap items-center gap-1.5 border-t pt-2">
      <Button v-if="can.approve" size="sm" :disabled="busy" @click="emit('approve', notice)"><Check />Setujui</Button>
      <Button v-if="can.reject" size="sm" variant="outline" :disabled="busy" @click="emit('reject', notice)"><X />Tolak</Button>
      <div class="ml-auto flex gap-0.5">
        <Button v-if="can.edit" size="icon" variant="ghost" class="text-muted-foreground size-7" aria-label="Ubah pengumuman" :disabled="busy" @click="emit('edit', notice)">
          <Pencil class="size-3.5" />
        </Button>
        <Button v-if="can.remove" size="icon" variant="ghost" class="text-muted-foreground size-7" aria-label="Hapus pengumuman" :disabled="busy" @click="emit('remove', notice)">
          <Trash2 class="size-3.5" />
        </Button>
      </div>
    </div>
  </article>
</template>
