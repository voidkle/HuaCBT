<script setup lang="ts">
import { computed } from "vue";
import { Check, Fingerprint, Loader2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/utils/formatTime";
import type { MySession } from "../types";

interface Props {
  session: MySession;
  busy: boolean;
  /** The user has at least one registered device. */
  hasPasskey: boolean;
  /** Admin switched biometric presence on. */
  enabled: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ checkIn: []; register: [] }>();

const rule = computed(() => {
  const parts = [`Dibuka ${formatClock(props.session.startedAt)}`];
  if (props.session.closesAt) parts.push(`ditutup ${formatClock(props.session.closesAt)}`);
  if (props.session.lateAfterMinutes) parts.push(`terlambat setelah ${props.session.lateAfterMinutes} menit`);
  return parts.join(" · ");
});
</script>

<template>
  <article class="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs sm:flex-row sm:items-center">
    <div class="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full" aria-hidden="true"><Fingerprint class="size-5" /></div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">{{ session.title }}</p>
      <p class="text-muted-foreground truncate text-xs">{{ session.classroomName }} · {{ rule }}</p>
    </div>
    <div v-if="session.mine" class="flex items-center gap-2 text-sm" role="status">
      <Check class="size-4 text-emerald-600 dark:text-emerald-400" />
      <span>Presensi {{ formatClock(session.mine.checkedAt) }}</span>
      <Badge v-if="session.mine.late" variant="outline" class="text-amber-700 dark:text-amber-400">Terlambat</Badge>
    </div>
    <p v-else-if="!enabled" class="text-muted-foreground text-xs">Presensi biometrik sedang dinonaktifkan.</p>
    <Button v-else-if="!hasPasskey" variant="outline" @click="emit('register')">Daftarkan perangkat dulu</Button>
    <Button v-else :disabled="busy" @click="emit('checkIn')">
      <Loader2 v-if="busy" class="animate-spin" />
      <Fingerprint v-else />
      Presensi sekarang
    </Button>
  </article>
</template>
