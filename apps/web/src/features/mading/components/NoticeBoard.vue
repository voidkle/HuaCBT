<script setup lang="ts">
import { computed } from "vue";
import { CircleCheck, CircleX, Clock } from "lucide-vue-next";
import type { Notice, NoticePermissions, NoticeStatus } from "../types";
import NoticeCard from "./NoticeCard.vue";

interface Props {
  notices: Notice[];
  permissions: NoticePermissions;
  busy: boolean;
}
const props = defineProps<Props>();
defineEmits<{ edit: [notice: Notice]; remove: [notice: Notice]; approve: [notice: Notice]; reject: [notice: Notice] }>();

const columns = [
  { status: "pending", label: "Menunggu", icon: Clock, tone: "text-muted-foreground" },
  { status: "approved", label: "Disetujui", icon: CircleCheck, tone: "text-chart-2" },
  { status: "rejected", label: "Ditolak", icon: CircleX, tone: "text-destructive" },
] as const satisfies readonly { status: NoticeStatus; label: string; icon: unknown; tone: string }[];

const board = computed(() => columns.map((c) => ({ ...c, notices: props.notices.filter((n) => n.status === c.status) })));
</script>

<template>
  <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
    <section v-for="col in board" :key="col.status" :aria-label="col.label" class="bg-muted flex flex-col gap-2 rounded-xl p-2">
      <header class="flex items-center gap-2 px-1.5 py-1">
        <component :is="col.icon" class="size-3.5" :class="col.tone" />
        <h2 class="text-[13px] font-medium">{{ col.label }}</h2>
        <span class="text-muted-foreground text-xs">{{ col.notices.length }}</span>
      </header>

      <NoticeCard
        v-for="n in col.notices"
        :key="n.id"
        :notice="n"
        :permissions="permissions"
        :busy="busy"
        @edit="$emit('edit', $event)"
        @remove="$emit('remove', $event)"
        @approve="$emit('approve', $event)"
        @reject="$emit('reject', $event)"
      />

      <p v-if="col.notices.length === 0" class="text-muted-foreground rounded-lg border border-dashed py-6 text-center text-xs">Tidak ada pengumuman.</p>
    </section>
  </div>
</template>
