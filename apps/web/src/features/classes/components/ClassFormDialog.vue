<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassInput, ClassSummary, ClassSystem, Teacher } from "../types";

interface Props {
  /** null = a new class. */
  classroom: ClassSummary | null;
  teachers: Teacher[];
  /** The school-wide mode (Config); only the wording depends on it. */
  system: ClassSystem;
  submitting: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ submit: [input: ClassInput] }>();
const open = defineModel<boolean>("open", { required: true });

const NONE = "none";
const name = ref("");
const grade = ref("");
const homeroom = ref(NONE);

const teacherLabel = computed(() => (props.system === "homeroom_teacher" ? "Guru kelas" : "Wali kelas"));
const teacherOptions = computed(() => [{ value: NONE, label: "Belum ditentukan" }, ...props.teachers.map((t) => ({ value: String(t.id), label: `${t.name} (@${t.username})` }))]);
const valid = computed(() => name.value.trim() !== "");

watch(open, (isOpen) => {
  if (!isOpen) return;
  name.value = props.classroom?.name ?? "";
  grade.value = props.classroom?.grade ?? "";
  homeroom.value = props.classroom?.homeroomTeacherId ? String(props.classroom.homeroomTeacherId) : NONE;
});

const submit = () =>
  valid.value && emit("submit", { name: name.value.trim(), grade: grade.value.trim() || null, homeroomTeacherId: homeroom.value === NONE ? null : Number(homeroom.value) });
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ classroom ? "Ubah kelas" : "Kelas baru" }}</DialogTitle>
        <DialogDescription>{{ system === "homeroom_teacher" ? "Sistem guru kelas: satu guru mengajar hampir semua pelajaran." : "Sistem guru mata pelajaran: setiap pelajaran punya guru sendiri, dengan seorang wali kelas." }} Sistem diatur admin di halaman Pengaturan.</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <div class="flex flex-col gap-1.5">
            <Label for="cls-name">Nama kelas</Label>
            <Input id="cls-name" v-model="name" maxlength="80" placeholder="mis. 3A atau X IPA 1" autocomplete="off" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="cls-grade">Tingkat</Label>
            <Input id="cls-grade" v-model="grade" maxlength="20" placeholder="mis. 3 / X" autocomplete="off" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label>{{ teacherLabel }}</Label>
          <BaseSelect v-model="homeroom" :options="teacherOptions" :label="teacherLabel" />
          <p class="text-muted-foreground text-xs">{{ teacherLabel }} juga mengelola presensi kelas ini.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting"><Loader2 v-if="submitting" class="animate-spin" />Simpan</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
