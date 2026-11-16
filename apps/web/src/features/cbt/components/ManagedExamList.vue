<script setup lang="ts">
import { ref } from "vue";
import { BarChart3, Pencil, Plus, Trash2 } from "lucide-vue-next";
import { RouterLink, useRouter } from "vue-router";
import { Badge } from "@/components/ui/badge";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useManagedExams } from "../composables/useManagedExams";
import { durationLabel, windowLabel } from "../services/examLabels";
import type { ManagedExam } from "../types";

const auth = useAuthStore();
const router = useRouter();
const { exams, loading, error, busy, load, create, remove } = useManagedExams();

const deleting = ref<ManagedExam | null>(null);

async function createAndOpen() {
  const id = await create();
  if (id) await router.push(`/cbt/exams/${id}/edit`);
}
async function confirmDelete() {
  if (deleting.value && (await remove(deleting.value.id))) deleting.value = null;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <p class="text-muted-foreground text-xs">{{ auth.hasRole("teacher") ? "Ujian yang kamu buat." : "Semua ujian." }} Pilihan ganda dinilai otomatis; esai kamu nilai sendiri.</p>
      <Button class="shrink-0 self-start sm:ml-auto sm:self-auto" :disabled="busy" @click="createAndOpen"><Plus />Ujian baru</Button>
    </div>

    <div v-if="loading" class="flex flex-col gap-3" aria-busy="true"><Skeleton v-for="i in 3" :key="i" class="h-24 rounded-xl" /></div>

    <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" @click="load">Coba lagi</Button>
    </div>

    <p v-else-if="exams.length === 0" class="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">Belum ada ujian. Buat yang pertama dengan tombol di atas.</p>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="e in exams" :key="e.id">
        <Card class="gap-2 py-3">
          <CardContent class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <RouterLink :to="`/cbt/exams/${e.id}/edit`" class="min-w-0 truncate text-[13px] font-medium hover:underline">{{ e.title }}</RouterLink>
              <Badge variant="outline" :class="e.status === 'published' ? 'bg-secondary text-secondary-foreground border-transparent' : ''">{{ e.status === "published" ? "Terbit" : "Draf" }}</Badge>
              <Badge v-if="e.needsGrading" variant="outline">{{ e.needsGrading }} perlu dinilai</Badge>
            </div>
            <p class="text-muted-foreground text-xs">
              {{ e.questionCount }} soal · {{ e.totalPoints }} poin · {{ durationLabel(e.durationMinutes) }} · {{ e.attempts }} dikumpulkan
              <template v-if="e.ownerName && !auth.hasRole('teacher')"> · {{ e.ownerName }}</template>
            </p>
            <p class="text-muted-foreground text-xs">{{ windowLabel(e.opensAt, e.closesAt) }}</p>
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <Button as-child size="sm" variant="outline"><RouterLink :to="`/cbt/exams/${e.id}/edit`"><Pencil />Edit</RouterLink></Button>
              <Button as-child size="sm" variant="outline"><RouterLink :to="`/cbt/exams/${e.id}/results`"><BarChart3 />Hasil</RouterLink></Button>
              <Button size="icon" variant="ghost" class="text-muted-foreground ml-auto size-8" :aria-label="`Hapus ${e.title}`" @click="deleting = e"><Trash2 class="size-3.5" /></Button>
            </div>
          </CardContent>
        </Card>
      </li>
    </ul>

    <BaseConfirmDialog
      :open="deleting !== null"
      title="Hapus ujian?"
      :description="`&quot;${deleting?.title ?? ''}&quot; beserta semua pertanyaan, jawaban siswa, dan nilainya akan dihapus permanen.`"
      :submitting="busy"
      @update:open="(v: boolean) => !v && (deleting = null)"
      @confirm="confirmDelete"
    />
  </div>
</template>
