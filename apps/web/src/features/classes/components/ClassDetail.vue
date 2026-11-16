<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClassDetail } from "../composables/useClassDetail";
import type { ClassSubject, ClassSummary, Lesson, LessonInput, Room, Subject, Teacher } from "../types";
import DaySchedule from "./DaySchedule.vue";
import LessonFormDialog from "./LessonFormDialog.vue";
import SubjectAssignDialog from "./SubjectAssignDialog.vue";

interface Props {
  summary: ClassSummary;
  canManage: boolean;
  subjects: Subject[];
  rooms: Room[];
  teachers: Teacher[];
  /** Moving class is on (Config): lessons may name a room. */
  moving: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ edit: [] }>();

const classId = toRef(() => props.summary.id);
const d = useClassDetail(classId);

const assignOpen = ref(false);
const assignEditing = ref<ClassSubject | null>(null);
const lessonOpen = ref(false);
const lessonEditing = ref<Lesson | null>(null);
const removingSubject = ref<ClassSubject | null>(null);
const removingLesson = ref<Lesson | null>(null);

const homeroomClass = computed(() => d.detail.value?.system === "homeroom_teacher");
const teacherTitle = computed(() => (homeroomClass.value ? "Guru kelas" : "Wali kelas"));
const freeSubjects = computed(() => {
  const taken = new Set(d.detail.value?.subjects.map((s) => s.subjectId));
  return props.subjects.filter((s) => !taken.has(s.id));
});
const assignChoices = computed(() => (assignEditing.value ? props.subjects : freeSubjects.value));

// the directory reloads its list after the class itself was edited: refresh the details too
watch(() => props.summary, () => void d.load(true));

function addSubject() {
  assignEditing.value = null;
  assignOpen.value = true;
}
function editSubject(s: ClassSubject) {
  assignEditing.value = s;
  assignOpen.value = true;
}
async function submitAssign(subjectId: number, teacherId: number | null) {
  if (await d.assign(subjectId, teacherId)) assignOpen.value = false;
}
async function confirmRemoveSubject() {
  if (removingSubject.value) await d.unassign(removingSubject.value.subjectId);
  removingSubject.value = null;
}

function addLesson() {
  lessonEditing.value = null;
  lessonOpen.value = true;
}
function editLesson(l: Lesson) {
  lessonEditing.value = l;
  lessonOpen.value = true;
}
async function submitLesson(subjectId: number, input: LessonInput) {
  const saved = lessonEditing.value ? await d.editLesson(lessonEditing.value.id, input) : await d.addLesson(subjectId, input);
  if (saved) lessonOpen.value = false;
}
async function confirmRemoveLesson() {
  if (removingLesson.value) await d.removeLesson(removingLesson.value.id);
  removingLesson.value = null;
}
</script>

<template>
  <div v-if="d.loading.value" class="flex flex-col gap-3" aria-busy="true"><Skeleton class="h-16 rounded-xl" /><Skeleton class="h-40 rounded-xl" /></div>
  <div v-else-if="d.error.value" class="flex flex-col items-start gap-2" role="alert">
    <p class="text-destructive text-sm">{{ d.error.value }}</p>
    <Button variant="outline" size="sm" @click="d.load()">Coba lagi</Button>
  </div>
  <div v-else-if="d.detail.value" class="flex flex-col gap-5">
    <header class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-base font-semibold">{{ d.detail.value.name }}<span v-if="d.detail.value.grade" class="text-muted-foreground font-normal"> · Kelas {{ d.detail.value.grade }}</span></h2>
        <p class="text-muted-foreground text-xs">
          {{ homeroomClass ? "Sistem guru kelas" : "Sistem guru mata pelajaran" }} · {{ teacherTitle }}: {{ d.detail.value.homeroomTeacherName ?? "belum ditentukan" }} · {{ d.detail.value.memberCount }} anggota
        </p>
      </div>
      <Button v-if="canManage" variant="outline" size="sm" @click="emit('edit')"><Pencil />Ubah kelas</Button>
    </header>

    <section class="flex flex-col gap-2" aria-labelledby="subj-h">
      <div class="flex items-center gap-2">
        <h3 id="subj-h" class="text-sm font-medium">Mata pelajaran &amp; guru</h3>
        <Button v-if="canManage" variant="outline" size="sm" class="ml-auto" @click="addSubject"><Plus />Tambah</Button>
      </div>
      <p v-if="d.detail.value.subjects.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">
        Belum ada mata pelajaran.{{ canManage ? " Tambahkan agar bisa menyusun jadwal." : "" }}
      </p>
      <ul v-else class="bg-card divide-y rounded-xl border shadow-xs">
        <li v-for="s in d.detail.value.subjects" :key="s.subjectId" class="flex items-center gap-2 px-3 py-2">
          <span class="min-w-0 flex-1">
            <span class="text-sm font-medium">{{ s.name }}</span>
            <span class="text-muted-foreground block truncate text-xs">{{ s.effectiveTeacherName ?? "Guru belum ditentukan" }}</span>
          </span>
          <Badge v-if="s.inherited" variant="secondary" class="text-[11px]">Guru kelas</Badge>
          <span v-if="canManage" class="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="icon" :aria-label="`Ganti guru ${s.name}`" @click="editSubject(s)"><Pencil /></Button>
            <Button variant="ghost" size="icon" :aria-label="`Lepas ${s.name}`" @click="removingSubject = s"><Trash2 /></Button>
          </span>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-2" aria-labelledby="sched-h">
      <div class="flex items-center gap-2">
        <h3 id="sched-h" class="text-sm font-medium">Jadwal pelajaran</h3>
        <Button v-if="canManage" variant="outline" size="sm" class="ml-auto" :disabled="d.detail.value.subjects.length === 0" @click="addLesson"><Plus />Tambah jam</Button>
      </div>
      <p v-if="d.detail.value.lessons.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">Belum ada jadwal.</p>
      <DaySchedule v-else :lessons="d.detail.value.lessons" :editable="canManage" @edit="editLesson" @remove="removingLesson = $event" />
    </section>

    <slot name="extra" :classroom-id="summary.id" />

    <SubjectAssignDialog
      v-model:open="assignOpen"
      :editing="assignEditing"
      :subjects="assignChoices"
      :teachers="teachers"
      :system="d.detail.value.system"
      :homeroom-teacher-name="d.detail.value.homeroomTeacherName"
      :submitting="d.busy.value"
      @submit="submitAssign"
    />
    <LessonFormDialog v-model:open="lessonOpen" :lesson="lessonEditing" :subjects="d.detail.value.subjects" :rooms="rooms" :moving="moving" :submitting="d.busy.value" @submit="submitLesson" />
    <BaseConfirmDialog
      :open="removingSubject !== null"
      title="Lepas mata pelajaran?"
      :description="`&quot;${removingSubject?.name ?? ''}&quot; dilepas dari kelas ini dan semua jam pelajarannya ikut dihapus.`"
      confirm-label="Lepas"
      :submitting="d.busy.value"
      @update:open="(v: boolean) => !v && (removingSubject = null)"
      @confirm="confirmRemoveSubject"
    />
    <BaseConfirmDialog
      :open="removingLesson !== null"
      title="Hapus jam pelajaran?"
      :description="`${removingLesson?.subjectName ?? ''} pada jadwal ini dihapus.`"
      :submitting="d.busy.value"
      @update:open="(v: boolean) => !v && (removingLesson = null)"
      @confirm="confirmRemoveLesson"
    />
  </div>
</template>
