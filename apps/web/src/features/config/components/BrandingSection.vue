<script setup lang="ts">
import { computed, ref } from "vue";
import { GraduationCap, Loader2, Trash2, Upload } from "lucide-vue-next";
import AppFooter from "@/components/layout/AppFooter.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_URL } from "@/services/api";
import { LOGO_TYPES } from "../types";

interface Props {
  logoUrl: string | null;
  logoBusy: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ upload: [file: File]; remove: [] }>();

const siteTitle = defineModel<string>("siteTitle", { required: true });
const copyrightHolder = defineModel<string>("copyrightHolder", { required: true });

const fileInput = ref<HTMLInputElement | null>(null);
const logoSrc = computed(() => (props.logoUrl ? API_URL + props.logoUrl : null));

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) emit("upload", file);
  input.value = ""; // allow re-selecting the same file
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Identitas</CardTitle>
      <CardDescription>Judul, logo, dan teks hak cipta yang tampil di seluruh aplikasi.</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-5">
      <div class="flex flex-col gap-1.5">
        <Label for="siteTitle">Judul situs</Label>
        <Input id="siteTitle" v-model="siteTitle" maxlength="60" required />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label>Logo</Label>
        <div class="flex items-center gap-3">
          <div class="bg-muted flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
            <img v-if="logoSrc" :src="logoSrc" alt="Logo saat ini" class="size-full object-contain" />
            <GraduationCap v-else class="text-muted-foreground size-6" />
          </div>
          <div class="flex flex-col gap-1.5">
            <div class="flex gap-2">
              <Button type="button" variant="outline" size="sm" :disabled="logoBusy" @click="fileInput?.click()">
                <Loader2 v-if="logoBusy" class="animate-spin" />
                <Upload v-else />
                Unggah logo
              </Button>
              <Button v-if="logoUrl" type="button" variant="ghost" size="sm" :disabled="logoBusy" @click="emit('remove')">
                <Trash2 />
                Hapus
              </Button>
            </div>
            <p class="text-muted-foreground text-xs">PNG, JPG, atau WebP, maksimal 1 MB. Perubahan logo langsung tersimpan.</p>
          </div>
          <input ref="fileInput" type="file" class="sr-only" :accept="LOGO_TYPES.join(',')" aria-label="Pilih berkas logo" @change="onPick" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="holder">Pemegang hak cipta</Label>
        <Input id="holder" v-model="copyrightHolder" maxlength="80" required />
        <div class="bg-muted mt-1 rounded-lg border border-dashed">
          <AppFooter :holder="copyrightHolder || '…'" />
        </div>
        <p class="text-muted-foreground text-xs">Pratinjau footer. Tahun otomatis, dan kredit "Powered by huaEBL by ruthkle" tidak dapat diubah.</p>
      </div>
    </CardContent>
  </Card>
</template>
