<script setup lang="ts">
import { computed, ref } from "vue";
import { LocateFixed } from "lucide-vue-next";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  aiApiKeySet: boolean;
}
defineProps<Props>();

const classSystem = defineModel<"homeroom_teacher" | "subject_teachers">("classSystem", { required: true });
const movingClass = defineModel<boolean>("movingClass", { required: true });
const biometricsEnabled = defineModel<boolean>("biometricsEnabled", { required: true });

const classSystemOptions = [
  { value: "homeroom_teacher", label: "Guru kelas (SD)" },
  { value: "subject_teachers", label: "Guru mata pelajaran (SMP/SMA/SMK)" },
];
const schoolLat = defineModel<number | null>("schoolLat", { required: true });
const schoolLng = defineModel<number | null>("schoolLng", { required: true });
const schoolRadiusM = defineModel<number>("schoolRadiusM", { required: true });
const aiSummaryEnabled = defineModel<boolean>("aiSummaryEnabled", { required: true });
/** undefined = keep the stored key, "" = remove it, otherwise replace it. */
const aiApiKey = defineModel<string | undefined>("aiApiKey");

// text <-> number|null for the inputs; an out-of-range or half-typed value is ignored until it is valid
const coordinate = (model: { value: number | null }, limit: number) =>
  computed({
    get: () => (model.value === null ? "" : String(model.value)),
    set: (v: string) => {
      const n = Number(v);
      if (v.trim() === "") model.value = null;
      else if (Number.isFinite(n) && Math.abs(n) <= limit) model.value = n;
    },
  });
const lat = coordinate(schoolLat, 90);
const lng = coordinate(schoolLng, 180);
const radius = computed({
  get: () => String(schoolRadiusM.value),
  set: (v: string) => {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 20 && n <= 5000) schoolRadiusM.value = n;
  },
});

const locating = ref(false);
const locateError = ref<string | null>(null);
function useMyLocation() {
  locating.value = true;
  locateError.value = null;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      schoolLat.value = Number(p.coords.latitude.toFixed(6));
      schoolLng.value = Number(p.coords.longitude.toFixed(6));
      locating.value = false;
    },
    () => {
      locateError.value = "Lokasi tidak tersedia. Izinkan akses lokasi di browser, atau isi koordinat manual.";
      locating.value = false;
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  );
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Fitur</CardTitle>
      <CardDescription>Aktifkan atau nonaktifkan fitur opsional.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5">
      <div class="flex flex-col gap-1.5">
        <Label>Sistem kelas</Label>
        <BaseSelect v-model="classSystem" :options="classSystemOptions" label="Sistem kelas" />
        <p class="text-muted-foreground text-xs">
          Berlaku untuk semua kelas. Guru kelas: satu guru mengajar hampir semua pelajaran. Guru mata pelajaran: setiap pelajaran punya guru sendiri dan satu wali kelas per kelas. Beralih ke guru mata pelajaran ditolak selama masih ada pelajaran tanpa guru.
        </p>
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="movingClass">Moving class</Label>
          <p class="text-muted-foreground text-xs">Siswa berpindah ke ruang mata pelajaran. Jika mati, ruang disembunyikan dan semua pelajaran berlangsung di kelas.</p>
        </div>
        <Switch id="movingClass" v-model="movingClass" />
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="biometrics">Presensi biometrik</Label>
          <p class="text-muted-foreground text-xs">Presensi sidik jari untuk siswa dan guru.</p>
        </div>
        <Switch id="biometrics" v-model="biometricsEnabled" />
      </div>

      <div v-if="biometricsEnabled" class="flex flex-col gap-2 rounded-lg border p-3">
        <p class="text-sm font-medium">Lokasi sekolah</p>
        <p class="text-muted-foreground text-xs">Presensi hanya diterima dalam radius ini. Kosongkan koordinat untuk tanpa batas lokasi. Lokasi dikirim browser, jadi ini pencegah, bukan bukti mutlak.</p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div class="flex flex-col gap-1.5"><Label for="school-lat">Lintang</Label><Input id="school-lat" v-model="lat" inputmode="decimal" placeholder="-6.200000" /></div>
          <div class="flex flex-col gap-1.5"><Label for="school-lng">Bujur</Label><Input id="school-lng" v-model="lng" inputmode="decimal" placeholder="106.816666" /></div>
          <div class="flex flex-col gap-1.5"><Label for="school-radius">Radius (meter)</Label><Input id="school-radius" v-model="radius" inputmode="numeric" /></div>
        </div>
        <div class="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" :disabled="locating" @click="useMyLocation"><LocateFixed />Pakai lokasi saya sekarang</Button>
          <p v-if="locateError" class="text-destructive text-xs" role="alert">{{ locateError }}</p>
        </div>
      </div>

      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="aiSummary">Ringkasan video dengan AI</Label>
          <p class="text-muted-foreground text-xs">Berbayar, memakai kunci API di bawah.</p>
        </div>
        <Switch id="aiSummary" v-model="aiSummaryEnabled" />
      </div>

      <div v-if="aiSummaryEnabled" class="flex flex-col gap-1.5">
        <Label for="aiKey">Kunci API AI</Label>
        <div class="flex gap-2">
          <Input
            id="aiKey"
            v-model="aiApiKey"
            type="password"
            autocomplete="off"
            :placeholder="aiApiKeySet ? 'Tersimpan. Isi untuk mengganti.' : 'Tempel kunci API'"
          />
          <Button v-if="aiApiKeySet && aiApiKey === undefined" type="button" variant="outline" @click="aiApiKey = ''">Hapus kunci</Button>
        </div>
        <p v-if="aiApiKey === ''" class="text-muted-foreground text-xs">Kunci akan dihapus saat disimpan.</p>
        <p v-else class="text-muted-foreground text-xs">Kunci tidak pernah ditampilkan kembali setelah disimpan.</p>
      </div>
    </CardContent>
  </Card>
</template>
