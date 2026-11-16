<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

interface Props {
  numPages: number;
  rtl: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ prev: []; next: [] }>();
const page = defineModel<number>("page", { required: true });
</script>

<template>
  <footer class="bg-background flex h-12 shrink-0 items-center gap-2 border-t px-2" :class="{ 'flex-row-reverse': rtl }">
    <Button variant="ghost" size="icon" :aria-label="rtl ? 'Halaman berikutnya' : 'Halaman sebelumnya'" @click="rtl ? emit('next') : emit('prev')"><ChevronLeft class="size-4" /></Button>
    <input
      v-model.number="page"
      type="range"
      min="1"
      :max="numPages"
      :dir="rtl ? 'rtl' : 'ltr'"
      class="accent-primary h-1 min-w-0 flex-1 cursor-pointer"
      aria-label="Geser untuk pindah halaman"
    />
    <span class="text-muted-foreground w-20 shrink-0 text-center text-xs tabular-nums" aria-live="polite">{{ page }} / {{ numPages }}</span>
    <Button variant="ghost" size="icon" :aria-label="rtl ? 'Halaman sebelumnya' : 'Halaman berikutnya'" @click="rtl ? emit('prev') : emit('next')"><ChevronRight class="size-4" /></Button>
  </footer>
</template>
