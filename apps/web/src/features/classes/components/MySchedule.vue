<script setup lang="ts">
import { DoorOpen } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMySchedule } from "../composables/useMySchedule";
import { toTime, weekdayOf } from "../services/timeService";
import DaySchedule from "./DaySchedule.vue";

const s = useMySchedule();
</script>

<template>
  <div v-if="s.loading.value" aria-busy="true"><Skeleton class="h-32 rounded-xl" /></div>
  <div v-else-if="s.error.value" class="flex flex-col items-start gap-2" role="alert">
    <p class="text-destructive text-sm">{{ s.error.value }}</p>
    <Button variant="outline" size="sm" @click="s.load()">Coba lagi</Button>
  </div>
  <p v-else-if="s.lessons.value.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">Belum ada jadwal untuk Anda.</p>
  <div v-else class="flex flex-col gap-4">
    <section class="bg-card flex flex-col gap-1 rounded-xl border p-4 shadow-xs" aria-live="polite" aria-label="Pelajaran sekarang">
      <template v-if="s.current.value">
        <p class="text-muted-foreground text-xs">Sekarang · sampai {{ toTime(s.current.value.endMin) }}</p>
        <p class="text-base font-semibold">{{ s.current.value.subjectName }} <span class="text-muted-foreground text-sm font-normal">· {{ s.current.value.classroomName }}</span></p>
        <p class="flex items-center gap-1 text-sm">
          <DoorOpen class="size-4" aria-hidden="true" />{{ s.current.value.roomName ? `Pindah ke ${s.current.value.roomName}` : "Tetap di kelas" }}
        </p>
      </template>
      <p v-else class="text-sm">Tidak ada pelajaran berlangsung.</p>
      <p v-if="s.next.value" class="text-muted-foreground mt-1 text-xs">
        Berikutnya {{ toTime(s.next.value.startMin) }}: {{ s.next.value.subjectName }} · {{ s.next.value.classroomName }} · {{ s.next.value.roomName ? `pindah ke ${s.next.value.roomName}` : "di kelas" }}
      </p>
    </section>
    <DaySchedule :lessons="s.lessons.value" :current-id="s.current.value?.id ?? null" :today="weekdayOf(new Date())" />
  </div>
</template>
