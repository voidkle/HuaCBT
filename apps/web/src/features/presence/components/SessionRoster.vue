<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { DoorClosed, DoorOpen, Loader2, Pencil, Trash2 } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/formatDate";
import { formatClock } from "@/utils/formatTime";
import { useSessionRoster } from "../composables/useSessionRoster";
import type { Classroom, SessionInput } from "../types";

interface Props {
  classroom: Classroom;
}
const props = defineProps<Props>();
const emit = defineEmits<{ edit: []; delete: []; changed: [] }>();

const { sessions, selected, selectedId, detail, loading, error, busy, load, select, open, close, remove } = useSessionRoster(
  toRef(() => props.classroom.id),
  () => emit("changed"),
);

const formOpen = ref(false);
const title = ref("");
const duration = ref("");
const lateAfter = ref("");
const confirmingDelete = ref(false);
const confirmingClose = ref(false);

const hasOpen = computed(() => sessions.value.some((s) => s.open));
const titleOk = computed(() => title.value.trim() !== "");
const minutes = (v: string) => (/^\d{1,4}$/.test(v.trim()) && Number(v) > 0 ? Number(v) : undefined);
const numbersOk = computed(() => (duration.value.trim() === "" || minutes(duration.value) !== undefined) && (lateAfter.value.trim() === "" || minutes(lateAfter.value) !== undefined));

watch(formOpen, (isOpen) => {
  if (!isOpen) return;
  title.value = `Pertemuan ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long" })}`;
  duration.value = "";
  lateAfter.value = "";
});

async function submitOpen() {
  const input: SessionInput = { title: title.value.trim(), durationMinutes: minutes(duration.value), lateAfterMinutes: minutes(lateAfter.value) };
  if (await open(input)) formOpen.value = false;
}
async function confirmDelete() {
  if (selectedId.value !== null) await remove(selectedId.value);
  confirmingDelete.value = false;
}
async function confirmClose() {
  if (selectedId.value !== null) await close(selectedId.value);
  confirmingClose.value = false;
}

const rule = (s: { closesAt: Date | null; lateAfterMinutes: number | null; startedAt: Date }) =>
  [`Dibuka ${formatDateTime(s.startedAt)}`, s.closesAt ? `tutup otomatis ${formatClock(s.closesAt)}` : null, s.lateAfterMinutes ? `terlambat setelah ${s.lateAfterMinutes} menit` : null].filter(Boolean).join(" · ");
const status = (late: boolean | null, at: Date | null) => (at ? (late ? "Terlambat" : "Hadir") : "Belum");
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4" :aria-label="`Kelas ${classroom.name}`">
    <header class="flex flex-wrap items-center gap-2">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-base font-semibold">{{ classroom.name }}</h2>
        <p class="text-muted-foreground text-xs">{{ classroom.memberCount }} anggota · Pengajar: {{ classroom.ownerName }}</p>
      </div>
      <template v-if="classroom.canManage">
        <Button size="sm" :disabled="hasOpen || busy" :title="hasOpen ? 'Tutup sesi yang terbuka dulu' : undefined" @click="formOpen = true"><DoorOpen />Buka sesi</Button>
        <Button size="sm" variant="outline" @click="emit('edit')"><Pencil />Ubah</Button>
        <Button size="sm" variant="outline" class="text-destructive" @click="emit('delete')"><Trash2 />Hapus kelas</Button>
      </template>
    </header>

    <div v-if="loading" class="flex flex-col gap-2" aria-busy="true"><Skeleton class="h-10 rounded-xl" /><Skeleton class="h-40 rounded-xl" /></div>
    <div v-else-if="error" class="flex items-center gap-3" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" size="sm" @click="load()">Coba lagi</Button>
    </div>
    <p v-else-if="sessions.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-12 text-center text-sm">
      Belum ada sesi presensi.{{ classroom.canManage ? " Buka sesi saat kelas dimulai." : "" }}
    </p>

    <template v-else>
      <ul class="flex gap-2 overflow-x-auto pb-1" aria-label="Sesi presensi">
        <li v-for="s in sessions" :key="s.id" class="shrink-0">
          <button
            type="button"
            :aria-current="s.id === selectedId ? 'true' : undefined"
            :class="cn('focus-visible:ring-ring/50 flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-xs outline-none focus-visible:ring-[3px]', s.id === selectedId ? 'border-primary bg-card' : 'hover:bg-accent')"
            @click="select(s.id)"
          >
            <span class="flex items-center gap-1.5 font-medium">{{ s.title }}<Badge v-if="s.open" variant="secondary" class="text-[10px]">Terbuka</Badge></span>
            <span class="text-muted-foreground">{{ formatDateTime(s.startedAt) }}</span>
            <span v-if="s.stats" class="text-muted-foreground">Hadir {{ s.stats.present }}/{{ s.stats.total }}</span>
            <span v-else class="text-muted-foreground">{{ s.mine ? (s.mine.late ? "Anda terlambat" : "Anda hadir") : s.open ? "Belum presensi" : "Tidak hadir" }}</span>
          </button>
        </li>
      </ul>

      <div v-if="detail" class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ detail.title }}</p>
            <p class="text-muted-foreground text-xs">{{ rule(detail) }}{{ detail.closedAt ? ` · ditutup ${formatClock(detail.closedAt)}` : "" }}</p>
          </div>
          <template v-if="classroom.canManage">
            <Button v-if="detail.open" size="sm" variant="outline" :disabled="busy" @click="confirmingClose = true"><DoorClosed />Tutup sesi</Button>
            <Button size="sm" variant="ghost" :disabled="busy" @click="confirmingDelete = true"><Trash2 />Hapus sesi</Button>
          </template>
        </div>

        <template v-if="detail.roster">
          <p class="text-muted-foreground text-xs" role="status">
            Hadir {{ detail.roster.filter((r) => r.checkedAt).length }} dari {{ detail.roster.length }} · Terlambat {{ detail.roster.filter((r) => r.late).length }}
          </p>
          <p v-if="detail.roster.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm">Kelas ini belum punya anggota.</p>
          <div v-else class="overflow-x-auto rounded-xl border">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr><th class="px-3 py-2 font-medium">Nama</th><th class="px-3 py-2 font-medium">Status</th><th class="px-3 py-2 font-medium">Waktu</th><th class="px-3 py-2 font-medium">Jarak</th></tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="r in detail.roster" :key="r.id">
                  <td class="px-3 py-2">{{ r.name }} <span class="text-muted-foreground text-xs">@{{ r.username }}</span></td>
                  <td class="px-3 py-2">
                    <Badge :variant="r.checkedAt ? 'secondary' : 'outline'" :class="r.late ? 'text-amber-700 dark:text-amber-400' : !r.checkedAt ? 'text-muted-foreground' : ''">{{ status(r.late, r.checkedAt) }}</Badge>
                  </td>
                  <td class="text-muted-foreground px-3 py-2 text-xs">{{ r.checkedAt ? formatClock(r.checkedAt) : "–" }}</td>
                  <td class="text-muted-foreground px-3 py-2 text-xs">{{ r.distanceM != null ? `${r.distanceM} m` : "–" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <p v-else class="rounded-xl border p-4 text-sm" role="status">
          <template v-if="detail.mine">Presensi Anda tercatat pukul {{ formatClock(detail.mine.checkedAt) }}{{ detail.mine.late ? " (terlambat)" : "" }}.</template>
          <template v-else-if="detail.open">Sesi ini terbuka. Tekan "Presensi sekarang" di bagian atas halaman.</template>
          <template v-else>Anda tidak tercatat hadir di sesi ini.</template>
        </p>
      </div>
      <Skeleton v-else class="h-40 rounded-xl" aria-busy="true" />
    </template>

    <Dialog v-model:open="formOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buka sesi presensi</DialogTitle>
          <DialogDescription>Anggota kelas bisa presensi selama sesi terbuka.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="titleOk && numbersOk && submitOpen()">
          <div class="flex flex-col gap-1.5">
            <Label for="session-title">Judul</Label>
            <Input id="session-title" v-model="title" maxlength="120" autocomplete="off" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="session-duration">Tutup otomatis (menit)</Label>
              <Input id="session-duration" v-model="duration" inputmode="numeric" placeholder="Tanpa batas" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="session-late">Terlambat setelah (menit)</Label>
              <Input id="session-late" v-model="lateAfter" inputmode="numeric" placeholder="Tidak ada" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" :disabled="busy" @click="formOpen = false">Batal</Button>
            <Button type="submit" :disabled="!titleOk || !numbersOk || busy">
              <Loader2 v-if="busy" class="animate-spin" />
              Buka sesi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <BaseConfirmDialog
      :open="confirmingClose"
      title="Tutup sesi?"
      description="Anggota yang belum presensi tidak bisa lagi presensi di sesi ini."
      confirm-label="Tutup sesi"
      :destructive="false"
      :submitting="busy"
      @update:open="(v: boolean) => (confirmingClose = v)"
      @confirm="confirmClose"
    />
    <BaseConfirmDialog
      :open="confirmingDelete"
      title="Hapus sesi?"
      description="Sesi dan semua catatan presensinya dihapus permanen."
      :submitting="busy"
      @update:open="(v: boolean) => (confirmingDelete = v)"
      @confirm="confirmDelete"
    />
  </section>
</template>
