<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, Paperclip, Pencil, Trash2 } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/utils/formatDate";
import { useAssignmentDetail } from "../composables/useAssignmentDetail";
import { MAX_FILES, type AssignmentInput, type FileInfo, type RosterRow } from "../types";
import AssignmentFormDialog from "./AssignmentFormDialog.vue";
import FileList from "./FileList.vue";
import GradeDialog from "./GradeDialog.vue";
import SubmissionForm from "./SubmissionForm.vue";
import SubmissionsTable from "./SubmissionsTable.vue";

interface Props {
  assignmentId: number;
}
const props = defineProps<Props>();

const router = useRouter();
const d = useAssignmentDetail(toRef(() => props.assignmentId));

const editing = ref(false);
const deleting = ref(false);
const picker = ref<HTMLInputElement | null>(null);

const overdue = computed(() => (d.detail.value ? d.detail.value.dueAt < new Date() : false));

async function saveEdit(input: AssignmentInput) {
  if (await d.update(input)) editing.value = false;
}
async function confirmDelete() {
  if (await d.remove()) await router.replace("/assignments");
  deleting.value = false;
}
async function attach(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])];
  if (picker.value) picker.value.value = "";
  if (files.length) await d.attach(files);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Button variant="ghost" size="sm" class="-ml-2 self-start" @click="router.push('/assignments')"><ArrowLeft />Semua tugas</Button>

    <div v-if="d.loading.value" class="flex flex-col gap-3" aria-busy="true"><Skeleton class="h-20 rounded-xl" /><Skeleton class="h-40 rounded-xl" /></div>
    <div v-else-if="d.error.value" class="flex flex-col items-start gap-2" role="alert">
      <p class="text-destructive text-sm">{{ d.error.value }}</p>
      <Button variant="outline" size="sm" @click="d.load()">Coba lagi</Button>
    </div>

    <template v-else-if="d.detail.value">
      <header class="flex flex-wrap items-start gap-3">
        <div class="min-w-0 flex-1">
          <h1 class="text-lg font-semibold">{{ d.detail.value.title }}</h1>
          <p class="text-muted-foreground text-xs">
            {{ d.detail.value.subjectName }} · {{ d.detail.value.classroomName }}<template v-if="d.detail.value.teacherName"> · {{ d.detail.value.teacherName }}</template>
          </p>
          <p class="mt-1 flex flex-wrap items-center gap-2 text-sm">
            Tenggat {{ formatDateTime(d.detail.value.dueAt) }}
            <Badge v-if="overdue" variant="outline" class="text-destructive border-destructive/40 text-[11px]">Lewat</Badge>
            <Badge variant="outline" class="text-[11px]">{{ d.detail.value.maxPoints }} poin</Badge>
            <Badge variant="outline" class="text-[11px]">{{ d.detail.value.allowLate ? "Terlambat diterima" : "Tutup saat tenggat" }}</Badge>
          </p>
        </div>
        <div v-if="d.detail.value.canManage" class="flex gap-2">
          <Button variant="outline" size="sm" @click="editing = true"><Pencil />Ubah</Button>
          <Button variant="outline" size="sm" class="text-destructive border-destructive/40" @click="deleting = true"><Trash2 />Hapus</Button>
        </div>
      </header>

      <section v-if="d.detail.value.instructions" class="bg-card rounded-xl border p-4 shadow-xs" aria-label="Petunjuk">
        <p class="text-sm whitespace-pre-wrap">{{ d.detail.value.instructions }}</p>
      </section>

      <section v-if="d.detail.value.files.length || d.detail.value.canManage" class="flex flex-col gap-2" aria-label="Lampiran">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-medium">Lampiran</h2>
          <template v-if="d.detail.value.canManage">
            <input ref="picker" type="file" multiple class="sr-only" tabindex="-1" aria-hidden="true" @change="attach" />
            <Button variant="outline" size="sm" class="ml-auto" :disabled="d.busy.value || d.detail.value.files.length >= MAX_FILES" @click="picker?.click()"><Paperclip />Tambah</Button>
          </template>
        </div>
        <FileList :files="d.detail.value.files" :removable="d.detail.value.canManage" :disabled="d.busy.value" @remove="(f: FileInfo) => d.detach(f.id)" />
        <p v-if="!d.detail.value.files.length" class="text-muted-foreground text-xs">Belum ada lampiran.</p>
      </section>

      <section v-if="d.detail.value.canManage" class="flex flex-col gap-2" aria-labelledby="roster-h">
        <h2 id="roster-h" class="text-sm font-medium">Jawaban siswa ({{ d.roster.value.filter((r) => r.status !== "missing").length }}/{{ d.roster.value.length }})</h2>
        <SubmissionsTable :rows="d.roster.value" :max-points="d.detail.value.maxPoints" @open="(r: RosterRow) => r.submissionId !== null && d.open(r.submissionId)" />
      </section>
      <SubmissionForm v-else :assignment="d.detail.value" :max-mb="d.maxMb.value" :busy="d.busy.value" @submit="d.submit" />

      <AssignmentFormDialog v-model:open="editing" :assignment="d.detail.value" :targets="[]" :max-mb="d.maxMb.value" :submitting="d.busy.value" @update="saveEdit" />
      <GradeDialog
        :submission="d.opened.value"
        :busy="d.busy.value"
        @grade="(score, feedback) => d.opened.value && d.grade(d.opened.value.id, score, feedback)"
        @reopen="d.opened.value && d.reopen(d.opened.value.id)"
        @close="d.opened.value = null"
      />
      <BaseConfirmDialog
        :open="deleting"
        title="Hapus tugas?"
        description="Tugas, semua jawaban siswa, nilai, dan berkasnya dihapus permanen."
        :submitting="d.busy.value"
        @update:open="(v: boolean) => (deleting = v)"
        @confirm="confirmDelete"
      />
    </template>
  </div>
</template>
