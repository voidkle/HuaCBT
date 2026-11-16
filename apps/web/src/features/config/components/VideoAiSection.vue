<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface Props {
  transcriptionApiKeySet: boolean;
}
defineProps<Props>();

const transcriptionEnabled = defineModel<boolean>("transcriptionEnabled", { required: true });
const transcriptionBaseUrl = defineModel<string>("transcriptionBaseUrl", { required: true });
const transcriptionModel = defineModel<string>("transcriptionModel", { required: true });
const transcriptionLanguage = defineModel<string>("transcriptionLanguage", { required: true });
/** undefined = keep the stored key, "" = remove it, otherwise replace it. */
const transcriptionApiKey = defineModel<string | undefined>("transcriptionApiKey");
const aiBaseUrl = defineModel<string>("aiBaseUrl", { required: true });
const aiModel = defineModel<string>("aiModel", { required: true });
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Transkrip dan ringkasan video</CardTitle>
      <CardDescription>
        Keduanya memakai API yang kompatibel dengan OpenAI: bisa OpenAI sendiri (berbayar) atau server milik sendiri (gratis). Guru juga selalu bisa mengunggah berkas teks (.vtt atau .srt) tanpa biaya.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="transcription">Transkrip otomatis</Label>
          <p class="text-muted-foreground text-xs">Mengubah suara video menjadi teks, untuk siswa tunarungu dan pencarian di dalam video.</p>
        </div>
        <Switch id="transcription" v-model="transcriptionEnabled" />
      </div>

      <div v-if="transcriptionEnabled" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <Label for="stt-url">Alamat API transkrip</Label>
          <Input id="stt-url" v-model="transcriptionBaseUrl" type="url" maxlength="300" autocomplete="off" placeholder="https://api.openai.com/v1" />
          <p class="text-muted-foreground text-xs">Layanan harus menyediakan <code>/audio/transcriptions</code> (format verbose_json).</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label for="stt-model">Model</Label>
            <Input id="stt-model" v-model="transcriptionModel" maxlength="100" autocomplete="off" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="stt-lang">Bahasa (kode, kosong = otomatis)</Label>
            <Input id="stt-lang" v-model="transcriptionLanguage" maxlength="10" autocomplete="off" placeholder="id" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="stt-key">Kunci API transkrip</Label>
          <div class="flex gap-2">
            <Input id="stt-key" v-model="transcriptionApiKey" type="password" autocomplete="off" :placeholder="transcriptionApiKeySet ? 'Tersimpan. Isi untuk mengganti.' : 'Tempel kunci API (kosongkan untuk server tanpa kunci)'" />
            <Button v-if="transcriptionApiKeySet && transcriptionApiKey === undefined" type="button" variant="outline" @click="transcriptionApiKey = ''">Hapus kunci</Button>
          </div>
          <p class="text-muted-foreground text-xs">{{ transcriptionApiKey === "" ? "Kunci akan dihapus saat disimpan." : "Kunci tidak pernah ditampilkan kembali setelah disimpan." }}</p>
        </div>
      </div>

      <div class="flex flex-col gap-4 border-t pt-5">
        <div>
          <p class="text-[13px] font-medium">Model ringkasan AI</p>
          <p class="text-muted-foreground text-xs">Dipakai saat "Ringkasan AI" menyala (bagian Fitur di atas, beserta kunci API-nya).</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label for="ai-url">Alamat API</Label>
            <Input id="ai-url" v-model="aiBaseUrl" type="url" maxlength="300" autocomplete="off" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ai-model">Model</Label>
            <Input id="ai-model" v-model="aiModel" maxlength="100" autocomplete="off" placeholder="gpt-4o-mini" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
