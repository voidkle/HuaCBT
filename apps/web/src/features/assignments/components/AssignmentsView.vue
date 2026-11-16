<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Plus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignments } from "../composables/useAssignments";
import { fetchMaxMb } from "../services/assignmentsApi";
import type { NewAssignment } from "../types";
import AssignmentFormDialog from "./AssignmentFormDialog.vue";
import AssignmentRow from "./AssignmentRow.vue";

const router = useRouter();
const a = useAssignments();

const dialogOpen = ref(false);
const maxMb = ref<number | null>(null);

async function newAssignment() {
  dialogOpen.value = true;
  if (a.targets.value.length === 0) await a.loadTargets();
  maxMb.value ??= await fetchMaxMb().catch(() => null);
}
async function create(input: NewAssignment, files: File[]) {
  const id = await a.create(input, files);
  if (id !== null) {
    dialogOpen.value = false;
    await router.push(`/assignments/${id}`);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <p class="text-muted-foreground flex-1 text-xs">Tugas per kelas dan mata pelajaran: guru memposting dan menilai, siswa mengumpulkan teks atau berkas sebelum tenggat.</p>
      <Button v-if="a.canPost.value" variant="outline" @click="newAssignment"><Plus />Tugas baru</Button>
    </div>

    <div v-if="a.loading.value" class="flex flex-col gap-2" aria-busy="true"><Skeleton v-for="i in 3" :key="i" class="h-14 rounded-xl" /></div>
    <div v-else-if="a.error.value" class="flex flex-col items-start gap-2" role="alert">
      <p class="text-destructive text-sm">{{ a.error.value }}</p>
      <Button variant="outline" size="sm" @click="a.load()">Coba lagi</Button>
    </div>
    <p v-else-if="a.items.value.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
      {{ a.canPost.value ? "Belum ada tugas. Posting yang pertama." : "Belum ada tugas untuk kelas Anda." }}
    </p>
    <template v-else>
      <section v-if="a.upcoming.value.length" class="flex flex-col gap-2" aria-labelledby="up-h">
        <h2 id="up-h" class="text-sm font-medium">Belum lewat tenggat</h2>
        <AssignmentRow v-for="item in a.upcoming.value" :key="item.id" :item="item" />
      </section>
      <section v-if="a.past.value.length" class="flex flex-col gap-2" aria-labelledby="past-h">
        <h2 id="past-h" class="text-sm font-medium">Lewat tenggat</h2>
        <AssignmentRow v-for="item in a.past.value" :key="item.id" :item="item" />
      </section>
    </template>

    <AssignmentFormDialog v-model:open="dialogOpen" :assignment="null" :targets="a.targets.value" :max-mb="maxMb" :submitting="a.busy.value" @create="create" />
  </div>
</template>
