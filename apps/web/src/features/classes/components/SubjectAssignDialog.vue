<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ClassSubject, ClassSystem, Subject, Teacher } from "../types";

interface Props {
  /** null = adding a subject to the class. */
  editing: ClassSubject | null;
  /** Catalog subjects not yet in this class (the edited one is always listed). */
  subjects: Subject[];
  teachers: Teacher[];
  system: ClassSystem;
  homeroomTeacherName: string | null;
  submitting: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ submit: [subjectId: number, teacherId: number | null] }>();
const open = defineModel<boolean>("open", { required: true });

const HOMEROOM = "homeroom";
const subject = ref("");
const teacher = ref(HOMEROOM);

const homeroomClass = computed(() => props.system === "homeroom_teacher");
const subjectOptions = computed(() => props.subjects.map((s) => ({ value: String(s.id), label: s.name })));
const teacherOptions = computed(() => [
  ...(homeroomClass.value ? [{ value: HOMEROOM, label: `Guru kelas${props.homeroomTeacherName ? ` (${props.homeroomTeacherName})` : ""}` }] : []),
  ...props.teachers.map((t) => ({ value: String(t.id), label: `${t.name} (@${t.username})` })),
]);
const valid = computed(() => subject.value !== "" && (homeroomClass.value || teacher.value !== HOMEROOM));

watch(open, (isOpen) => {
  if (!isOpen) return;
  subject.value = props.editing ? String(props.editing.subjectId) : "";
  teacher.value = props.editing?.teacherId ? String(props.editing.teacherId) : homeroomClass.value ? HOMEROOM : "";
});

const submit = () => valid.value && emit("submit", Number(subject.value), teacher.value === HOMEROOM ? null : Number(teacher.value));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ editing ? "Ganti guru" : "Tambah mata pelajaran" }}</DialogTitle>
        <DialogDescription>
          {{ homeroomClass ? "Guru kelas mengajar pelajaran ini kecuali Anda memilih guru khusus (mis. Agama, PJOK, Bahasa Inggris)." : "Pilih guru yang mengajar pelajaran ini di kelas ini." }}
        </DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <Label>Mata pelajaran</Label>
          <BaseSelect v-model="subject" :options="subjectOptions" label="Mata pelajaran" placeholder="Pilih mata pelajaran" :disabled="editing !== null" />
          <p v-if="subjectOptions.length === 0" class="text-muted-foreground text-xs">Semua mata pelajaran sudah ada di kelas ini. Tambah yang baru di tab "Mapel &amp; ruang".</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>Guru</Label>
          <BaseSelect v-model="teacher" :options="teacherOptions" label="Guru" placeholder="Pilih guru" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting"><Loader2 v-if="submitting" class="animate-spin" />Simpan</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
