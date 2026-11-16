<script setup lang="ts">
import { ref } from "vue";
import { Plus } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEbookLibrary } from "../composables/useEbookLibrary";
import type { Ebook, EbookUploadInput } from "../types";
import EbookCard from "./EbookCard.vue";
import EbookUploadDialog from "./EbookUploadDialog.vue";

const { ebooks, loading, error, busy, canUpload, canDelete, load, upload, remove } = useEbookLibrary();

const uploadOpen = ref(false);
const deleting = ref<Ebook | null>(null);

async function submitUpload(input: EbookUploadInput) {
  if (await upload(input)) uploadOpen.value = false;
}
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p class="text-muted-foreground text-xs">Buku pelajaran dan bacaan. Mode baca bisa diganti di dalam pembaca: buku, gulir, atau halaman.</p>
      <Button v-if="canUpload" class="shrink-0 self-start sm:ml-auto sm:self-auto" @click="uploadOpen = true"><Plus />Unggah e-book</Button>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-busy="true">
      <Skeleton v-for="i in 5" :key="i" class="aspect-[3/5] rounded-xl" />
    </div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" @click="load">Coba lagi</Button>
    </div>

    <p v-else-if="ebooks.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">
      Belum ada e-book.{{ canUpload ? " Unggah PDF pertama dengan tombol di atas." : "" }}
    </p>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <EbookCard v-for="b in ebooks" :key="b.id" :ebook="b" :can-delete="canDelete(b)" @delete="deleting = $event" />
    </div>

    <EbookUploadDialog v-model:open="uploadOpen" :submitting="busy" @submit="submitUpload" />
    <BaseConfirmDialog
      :open="deleting !== null"
      title="Hapus e-book?"
      :description="`&quot;${deleting?.title ?? ''}&quot; dan progres baca semua orang akan dihapus permanen.`"
      :submitting="busy"
      @update:open="(v: boolean) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>
