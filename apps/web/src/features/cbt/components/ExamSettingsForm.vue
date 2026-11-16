<script setup lang="ts">
import { computed } from "vue";
import { Dices, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fromDatetimeLocal, toDatetimeLocal } from "@/utils/datetimeLocal";
import type { ExamSettings } from "../types";

interface Props {
  settings: ExamSettings;
  problem: string | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{ update: [settings: ExamSettings] }>();

const patch = (changes: Partial<ExamSettings>) => emit("update", { ...props.settings, ...changes });

const opensLocal = computed(() => toDatetimeLocal(props.settings.opensAt));
const closesLocal = computed(() => toDatetimeLocal(props.settings.closesAt));

// no confusing characters (0/O, 1/I): students type this in by hand
const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  patch({ accessToken: Array.from(bytes, (b) => TOKEN_CHARS[b % TOKEN_CHARS.length]).join("") });
}

const toggles = [
  { key: "shuffleQuestions", label: "Acak urutan soal", hint: "Setiap siswa mendapat urutan berbeda." },
  { key: "shuffleOptions", label: "Acak urutan pilihan jawaban", hint: "Berlaku untuk pilihan ganda; Benar/Salah tidak diacak." },
  { key: "showTimer", label: "Tampilkan timer di layar", hint: "Batas waktu tetap berlaku walau timer disembunyikan." },
  { key: "showScore", label: "Tampilkan nilai ke siswa", hint: "Nilai baru terlihat setelah semua esai dinilai." },
  { key: "showReview", label: "Tampilkan jawaban benar dan pembahasan", hint: "Siswa bisa meninjau hasilnya setelah dinilai." },
] as const;
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Pengaturan ujian</CardTitle>
      <CardDescription>Perubahan pengaturan berlaku untuk siswa yang mulai setelahnya.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5">
      <div class="flex flex-col gap-1.5">
        <Label for="exam-title">Judul</Label>
        <Input id="exam-title" :model-value="settings.title" maxlength="150" required autocomplete="off" @update:model-value="(v) => patch({ title: String(v) })" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="exam-desc">Deskripsi / petunjuk (opsional)</Label>
        <Textarea id="exam-desc" :model-value="settings.description" rows="3" maxlength="2000" class="md:text-[13px]" @update:model-value="(v) => patch({ description: String(v) })" />
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="exam-duration">Durasi (menit)</Label>
          <Input id="exam-duration" type="number" inputmode="numeric" min="1" max="600" step="1" placeholder="Tanpa batas" :model-value="settings.durationMinutes ?? ''" @update:model-value="(v) => patch({ durationMinutes: v === '' ? null : Number(v) })" />
          <p class="text-muted-foreground text-xs">Kosongkan jika tanpa batas waktu.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="exam-attempts">Jumlah kesempatan</Label>
          <Input id="exam-attempts" type="number" inputmode="numeric" min="1" max="20" step="1" :model-value="settings.maxAttempts" @update:model-value="(v) => patch({ maxAttempts: Number(v) })" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="exam-opens">Dibuka</Label>
          <Input id="exam-opens" type="datetime-local" :model-value="opensLocal" @update:model-value="(v) => patch({ opensAt: fromDatetimeLocal(String(v)) })" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="exam-closes">Ditutup</Label>
          <Input id="exam-closes" type="datetime-local" :model-value="closesLocal" @update:model-value="(v) => patch({ closesAt: fromDatetimeLocal(String(v)) })" />
          <p class="text-muted-foreground text-xs">Siswa yang masih mengerjakan dihentikan saat ditutup.</p>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="exam-token">Token akses (opsional)</Label>
        <div class="flex gap-2">
          <Input id="exam-token" :model-value="settings.accessToken ?? ''" maxlength="40" autocomplete="off" placeholder="Tanpa token" class="font-mono tracking-wider uppercase" @update:model-value="(v) => patch({ accessToken: String(v).trim() === '' ? null : String(v) })" />
          <Button type="button" variant="outline" class="shrink-0" @click="newToken"><Dices />Buat acak</Button>
          <Button v-if="settings.accessToken" type="button" variant="ghost" size="icon" class="shrink-0" aria-label="Hapus token" @click="patch({ accessToken: null })"><X class="size-4" /></Button>
        </div>
        <p class="text-muted-foreground text-xs">Siswa harus mengetik token ini untuk memulai. Tidak peduli huruf besar atau kecil.</p>
      </div>

      <div class="flex flex-col gap-4">
        <div v-for="t in toggles" :key="t.key" class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-0.5">
            <Label :for="`toggle-${t.key}`">{{ t.label }}</Label>
            <p class="text-muted-foreground text-xs">{{ t.hint }}</p>
          </div>
          <Switch :id="`toggle-${t.key}`" :model-value="settings[t.key]" @update:model-value="(v) => patch({ [t.key]: v })" />
        </div>
      </div>

      <p v-if="problem" class="text-destructive text-xs" role="alert">{{ problem }}</p>
    </CardContent>
  </Card>
</template>
