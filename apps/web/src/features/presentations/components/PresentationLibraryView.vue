<script setup lang="ts">
import { ref } from "vue";
import { Plus } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePresentationLibrary } from "../composables/usePresentationLibrary";
import type { Presentation, PresentationInput } from "../types";
import PresentationCard from "./PresentationCard.vue";
import PresentationUploadDialog from "./PresentationUploadDialog.vue";

const { items, loading, error, busy, canUpload, canDelete, load, upload, remove } = usePresentationLibrary();

const uploadOpen = ref(false);
const deleting = ref<Presentation | null>(null);

async function submitUpload(input: PresentationInput) {
  if (await upload(input)) uploadOpen.value = false;
}
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p class="text-muted-foreground text-xs">Slide pelajaran untuk dibaca. Unggah PowerPoint atau tempel tautan Google Slides / Canva; tombol Presentasi membukanya layar penuh.</p>
      <Button v-if="canUpload" class="shrink-0 self-start sm:ml-auto sm:self-auto" @click="uploadOpen = true"><Plus />Tambah presentasi</Button>
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
      <Skeleton v-for="i in 4" :key="i" class="aspect-[4/3] rounded-xl" />
    </div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" @click="load">Coba lagi</Button>
    </div>

    <p v-else-if="items.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
      Belum ada presentasi.{{ canUpload ? " Tambahkan yang pertama dengan tombol di atas." : "" }}
    </p>

    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <PresentationCard v-for="p in items" :key="p.id" :deck="p" :can-delete="canDelete(p)" @delete="deleting = $event" />
    </div>

    <PresentationUploadDialog v-model:open="uploadOpen" :submitting="busy" @submit="submitUpload" />
    <BaseConfirmDialog
      :open="deleting !== null"
      title="Hapus presentasi?"
      :description="`&quot;${deleting?.title ?? ''}&quot; dan progres semua orang akan dihapus permanen.`"
      :submitting="busy"
      @update:open="(v: boolean) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>
