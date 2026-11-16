<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const maxVideoMb = defineModel<number>("maxVideoMb", { required: true });
const maxPptMb = defineModel<number>("maxPptMb", { required: true });
const maxEbookMb = defineModel<number>("maxEbookMb", { required: true });
const maxChatMediaMb = defineModel<number>("maxChatMediaMb", { required: true });
const maxAssignmentMb = defineModel<number>("maxAssignmentMb", { required: true });

const fields = [
  { id: "maxVideoMb", label: "Video kursus", model: maxVideoMb },
  { id: "maxPptMb", label: "Presentasi (PPT)", model: maxPptMb },
  { id: "maxEbookMb", label: "E-book", model: maxEbookMb },
  { id: "maxChatMediaMb", label: "Media chat", model: maxChatMediaMb },
  { id: "maxAssignmentMb", label: "Tugas (per berkas)", model: maxAssignmentMb },
];
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Batas ukuran unggahan</CardTitle>
      <CardDescription>Ukuran maksimal per berkas, dalam MB (1 sampai 10.240). Berlaku saat fitur terkait aktif.</CardDescription>
    </CardHeader>
    <CardContent class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div v-for="f in fields" :key="f.id" class="flex flex-col gap-1.5">
        <Label :for="f.id">{{ f.label }}</Label>
        <div class="relative">
          <Input :id="f.id" v-model.number="f.model.value" type="number" inputmode="numeric" min="1" max="10240" step="1" class="pr-10" required />
          <span class="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">MB</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
