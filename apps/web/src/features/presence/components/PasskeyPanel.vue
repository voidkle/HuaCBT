<script setup lang="ts">
import { ref } from "vue";
import { Fingerprint, Loader2, Smartphone, Trash2 } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/utils/formatDate";
import type { Passkey } from "../types";

interface Props {
  items: Passkey[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  /** Browser + connection can do WebAuthn (needs https, except on localhost). */
  supported: boolean;
  /** Admin switched biometric presence on. */
  enabled: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ register: [label: string]; remove: [id: number]; retry: [] }>();

const label = ref("Perangkat saya");
const removing = ref<Passkey | null>(null);

function confirmRemove() {
  if (removing.value) emit("remove", removing.value.id);
  removing.value = null;
}
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-4">
    <p class="text-muted-foreground text-xs">
      Daftarkan ponsel atau laptop Anda sekali. Saat presensi, perangkat meminta sidik jari, wajah, atau kunci layar. Yang disimpan server hanya kunci publik, bukan data sidik jari.
    </p>

    <p v-if="!enabled" class="rounded-lg border border-dashed p-3 text-sm" role="status">Presensi biometrik sedang dinonaktifkan oleh admin.</p>
    <p v-else-if="!supported" class="rounded-lg border border-dashed p-3 text-sm" role="alert">
      Browser atau koneksi ini tidak mendukung biometrik. Gunakan browser terbaru dan buka aplikasi lewat HTTPS.
    </p>
    <form v-else class="flex flex-col gap-2 sm:flex-row sm:items-end" @submit.prevent="emit('register', label.trim() || 'Perangkat saya')">
      <div class="flex flex-1 flex-col gap-1.5">
        <Label for="passkey-label">Nama perangkat</Label>
        <Input id="passkey-label" v-model="label" maxlength="60" autocomplete="off" />
      </div>
      <Button type="submit" :disabled="busy">
        <Loader2 v-if="busy" class="animate-spin" />
        <Fingerprint v-else />
        Daftarkan perangkat ini
      </Button>
    </form>

    <div v-if="loading" class="flex flex-col gap-2" aria-busy="true"><Skeleton v-for="i in 2" :key="i" class="h-14 rounded-xl" /></div>
    <div v-else-if="error" class="flex items-center gap-3" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" size="sm" @click="emit('retry')">Coba lagi</Button>
    </div>
    <p v-else-if="items.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-8 text-center text-sm">Belum ada perangkat terdaftar.</p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="p in items" :key="p.id" class="bg-card flex items-center gap-3 rounded-xl border p-3 shadow-xs">
        <Smartphone class="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{{ p.label }}</p>
          <p class="text-muted-foreground text-xs">Didaftarkan {{ formatDateTime(p.createdAt) }}{{ p.lastUsedAt ? ` · terakhir dipakai ${formatDateTime(p.lastUsedAt)}` : "" }}</p>
        </div>
        <Button variant="ghost" size="icon" :aria-label="`Hapus perangkat ${p.label}`" :disabled="busy" @click="removing = p"><Trash2 /></Button>
      </li>
    </ul>

    <BaseConfirmDialog
      :open="removing !== null"
      title="Hapus perangkat?"
      :description="`&quot;${removing?.label ?? ''}&quot; tidak bisa dipakai presensi lagi. Anda bisa mendaftarkannya ulang.`"
      @update:open="(v: boolean) => !v && (removing = null)"
      @confirm="confirmRemove"
    />
  </div>
</template>
