<script setup lang="ts">
import { ArrowLeft, ArrowLeftRight, BookOpen, Maximize, Minimize, RectangleVertical, ScrollText, Share2 } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import type { ReaderMode } from "../types";

interface Props {
  title: string;
  mode: ReaderMode;
  rtl: boolean;
  /** The share button needs a loaded book. */
  canShare: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ "update:mode": [mode: ReaderMode]; "toggle-rtl": []; share: [] }>();

const modes = [
  { value: "flip", label: "Mode buku (balik halaman)", icon: BookOpen },
  { value: "scroll", label: "Mode gulir (vertikal)", icon: ScrollText },
  { value: "page", label: "Mode halaman (ketuk atau geser)", icon: RectangleVertical },
] as const;

const fullscreen = ref(false);
const syncFullscreen = () => (fullscreen.value = document.fullscreenElement !== null);
const toggleFullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);

onMounted(() => document.addEventListener("fullscreenchange", syncFullscreen));
onBeforeUnmount(() => document.removeEventListener("fullscreenchange", syncFullscreen));
</script>

<template>
  <header class="bg-background flex h-12 shrink-0 items-center gap-1 border-b px-2">
    <Button as-child variant="ghost" size="icon" aria-label="Kembali ke perpustakaan" title="Kembali ke perpustakaan">
      <RouterLink to="/ebooks"><ArrowLeft class="size-4" /></RouterLink>
    </Button>
    <h1 class="min-w-0 flex-1 truncate px-1 text-[13px] font-medium">{{ title }}</h1>

    <div class="flex items-center gap-0.5" role="group" aria-label="Mode baca">
      <Button
        v-for="m in modes"
        :key="m.value"
        variant="ghost"
        size="icon"
        :class="mode === m.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
        :aria-pressed="mode === m.value"
        :aria-label="m.label"
        :title="m.label"
        @click="emit('update:mode', m.value)"
      >
        <component :is="m.icon" class="size-4" />
      </Button>
    </div>
    <Button
      v-if="mode !== 'scroll'"
      variant="ghost"
      size="icon"
      :class="rtl ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
      :aria-pressed="rtl"
      aria-label="Baca dari kanan ke kiri (manga)"
      title="Baca dari kanan ke kiri (manga)"
      @click="emit('toggle-rtl')"
    >
      <ArrowLeftRight class="size-4" />
    </Button>
    <Button variant="ghost" size="icon" class="text-muted-foreground" :disabled="!canShare" aria-label="Bagikan halaman ini ke chat" title="Bagikan halaman ini ke chat" @click="emit('share')"><Share2 class="size-4" /></Button>
    <Button variant="ghost" size="icon" class="text-muted-foreground" :aria-label="fullscreen ? 'Keluar layar penuh' : 'Layar penuh'" :title="fullscreen ? 'Keluar layar penuh' : 'Layar penuh'" @click="toggleFullscreen">
      <Minimize v-if="fullscreen" class="size-4" />
      <Maximize v-else class="size-4" />
    </Button>
  </header>
</template>
