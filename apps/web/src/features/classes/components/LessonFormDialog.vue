<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fromTime, toTime, WEEKDAYS } from "../services/timeService";
import type { ClassSubject, Lesson, LessonInput, Room } from "../types";

interface Props {
  /** null = a new lesson. */
  lesson: Lesson | null;
  subjects: ClassSubject[];
  rooms: Room[];
  /** Moving class is on (Config); off = no room choice. */
  moving: boolean;
  submitting: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ submit: [subjectId: number, input: LessonInput] }>();
const open = defineModel<boolean>("open", { required: true });

const STAY = "stay";
const subject = ref("");
const weekday = ref("1");
const start = ref("07:00");
const end = ref("07:45");
const room = ref(STAY);

const subjectOptions = computed(() => props.subjects.map((s) => ({ value: String(s.subjectId), label: `${s.name}${s.effectiveTeacherName ? ` · ${s.effectiveTeacherName}` : ""}` })));
const dayOptions = WEEKDAYS.map((d, i) => ({ value: String(i + 1), label: d }));
const roomOptions = computed(() => [{ value: STAY, label: "Tetap di kelas ini" }, ...props.rooms.map((r) => ({ value: String(r.id), label: `Pindah ke ${r.name}${r.ownerName ? ` (${r.ownerName})` : ""}` }))]);
const timesOk = computed(() => fromTime(start.value) < fromTime(end.value));
const valid = computed(() => subject.value !== "" && timesOk.value);

watch(open, (isOpen) => {
  if (!isOpen) return;
  subject.value = props.lesson ? String(props.lesson.subjectId) : "";
  weekday.value = String(props.lesson?.weekday ?? 1);
  start.value = toTime(props.lesson?.startMin ?? 420);
  end.value = toTime(props.lesson?.endMin ?? 465);
  room.value = props.lesson?.roomId ? String(props.lesson.roomId) : STAY;
});

const submit = () =>
  valid.value && emit("submit", Number(subject.value), { weekday: Number(weekday.value), startMin: fromTime(start.value), endMin: fromTime(end.value), roomId: room.value === STAY ? null : Number(room.value) });
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ lesson ? "Ubah jam pelajaran" : "Tambah jam pelajaran" }}</DialogTitle>
        <DialogDescription>Jadwal mingguan. Guru dan ruang tidak boleh bentrok dengan kelas lain.</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <Label>Mata pelajaran</Label>
          <BaseSelect v-model="subject" :options="subjectOptions" label="Mata pelajaran" placeholder="Pilih mata pelajaran" :disabled="lesson !== null" />
          <p v-if="subjectOptions.length === 0" class="text-muted-foreground text-xs">Tambahkan mata pelajaran ke kelas ini dahulu.</p>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-3 flex flex-col gap-1.5 sm:col-span-1">
            <Label>Hari</Label>
            <BaseSelect v-model="weekday" :options="dayOptions" label="Hari" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="les-start">Mulai</Label>
            <Input id="les-start" v-model="start" type="time" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="les-end">Selesai</Label>
            <Input id="les-end" v-model="end" type="time" required />
          </div>
        </div>
        <p v-if="!timesOk" class="text-destructive -mt-2 text-xs" role="alert">Jam selesai harus setelah jam mulai.</p>
        <div v-if="moving" class="flex flex-col gap-1.5">
          <Label>Ruang</Label>
          <BaseSelect v-model="room" :options="roomOptions" label="Ruang" />
          <p class="text-muted-foreground text-xs">Pilih ruang jika siswa berpindah ke ruang mata pelajaran (sistem moving class).</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting"><Loader2 v-if="submitting" class="animate-spin" />Simpan</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
