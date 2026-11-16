<script setup lang="ts">
import { ref } from "vue";
import { Plus } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMading } from "../composables/useMading";
import type { Notice, NoticeInput } from "../types";
import NoticeBoard from "./NoticeBoard.vue";
import NoticeFormDialog from "./NoticeFormDialog.vue";
import NoticeRejectDialog from "./NoticeRejectDialog.vue";

const { notices, loading, error, busy, canReview, permissions, load, create, update, remove, approve, reject } = useMading();

const formOpen = ref(false);
const editing = ref<Notice | null>(null);
const rejecting = ref<Notice | null>(null);
const deleting = ref<Notice | null>(null);

function openCreate() {
  editing.value = null;
  formOpen.value = true;
}
function openEdit(n: Notice) {
  editing.value = n;
  formOpen.value = true;
}

async function submitForm(input: NoticeInput) {
  const ok = editing.value ? await update(editing.value.id, input) : await create(input);
  if (ok) formOpen.value = false;
}
async function confirmReject(note: string) {
  if (rejecting.value && (await reject(rejecting.value.id, note))) rejecting.value = null;
}
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p class="text-muted-foreground text-xs">
        {{ canReview ? "Setujui atau tolak pengumuman dari guru dan siswa." : "Pengumuman kamu tampil setelah disetujui staf. Pengumuman yang menunggu atau ditolak hanya terlihat olehmu dan staf." }}
      </p>
      <Button class="shrink-0 self-start sm:ml-auto sm:self-auto" @click="openCreate"><Plus />Pengumuman baru</Button>
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-3 lg:grid-cols-3" aria-busy="true">
      <Skeleton v-for="i in 3" :key="i" class="h-64 rounded-xl" />
    </div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" @click="load">Coba lagi</Button>
    </div>

    <NoticeBoard
      v-else
      :notices="notices"
      :permissions="permissions"
      :busy="busy"
      @edit="openEdit"
      @remove="deleting = $event"
      @approve="approve($event.id)"
      @reject="rejecting = $event"
    />

    <NoticeFormDialog v-model:open="formOpen" :notice="editing" :submitting="busy" :needs-approval="!canReview" @submit="submitForm" />
    <NoticeRejectDialog :open="rejecting !== null" :notice-title="rejecting?.title ?? ''" :submitting="busy" @update:open="(v) => !v && (rejecting = null)" @confirm="confirmReject" />
    <BaseConfirmDialog
      :open="deleting !== null"
      title="Hapus pengumuman?"
      :description="`&quot;${deleting?.title ?? ''}&quot; akan dihapus permanen dan tidak bisa dikembalikan.`"
      :submitting="busy"
      @update:open="(v: boolean) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>
