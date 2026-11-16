<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Loader2, Search } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import { formatDuration } from "@/utils/formatDuration";
import type { Cue, JobStatus } from "../types";

interface Props {
  cues: Cue[];
  activeIndex: number;
  status: JobStatus;
  error: string | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{ seek: [seconds: number] }>();

const query = ref("");
const list = ref<HTMLElement | null>(null);
const rows = ref<HTMLElement[]>([]);
let userScrolledAt = 0;

const needle = computed(() => query.value.trim().toLowerCase());
const visible = computed(() => props.cues.map((c, i) => ({ c, i })).filter(({ c }) => !needle.value || c.text.toLowerCase().includes(needle.value)));
const working = computed(() => props.status === "queued" || props.status === "processing");

/** Splits a cue into text and highlighted search hits. */
function parts(text: string): { text: string; hit: boolean }[] {
  const n = needle.value;
  if (!n) return [{ text, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  const lower = text.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(n); i !== -1; i = lower.indexOf(n, at)) {
    if (i > at) out.push({ text: text.slice(at, i), hit: false });
    out.push({ text: text.slice(i, i + n.length), hit: true });
    at = i + n.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

// follow the video, unless the reader scrolled on their own a moment ago or is searching
watch(
  () => props.activeIndex,
  async (i) => {
    if (i < 0 || needle.value || Date.now() - userScrolledAt < 4000) return;
    await nextTick();
    const el = list.value?.querySelector<HTMLElement>(`[data-cue="${i}"]`);
    if (el && list.value) list.value.scrollTo({ top: el.offsetTop - list.value.clientHeight / 3, behavior: "smooth" });
  },
);
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-2">
    <div v-if="cues.length" class="relative">
      <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input v-model="query" type="search" placeholder="Cari di transkrip…" class="pl-9" aria-label="Cari di transkrip" autocomplete="off" />
    </div>

    <p v-if="working" class="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-xs" role="status"><Loader2 class="size-4 animate-spin" />Transkrip sedang dibuat. Halaman ini diperbarui otomatis.</p>
    <p v-else-if="status === 'failed' && error" class="text-destructive rounded-lg border border-dashed px-3 py-3 text-xs" role="alert">Transkrip gagal dibuat: {{ error }}</p>
    <p v-if="!cues.length && !working && !(status === 'failed' && error)" class="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs">Belum ada transkrip untuk video ini.</p>
    <p v-else-if="status === 'failed' && error && cues.length" class="text-destructive text-xs" role="alert">Pembaruan transkrip gagal: {{ error }}. Transkrip sebelumnya tetap ditampilkan.</p>

    <ol v-if="cues.length" ref="list" class="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Transkrip" @wheel.passive="userScrolledAt = Date.now()" @touchmove.passive="userScrolledAt = Date.now()">
      <li v-for="{ c, i } in visible" :key="i" :data-cue="i">
        <button type="button" class="hover:bg-accent focus-visible:ring-ring/50 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] outline-none focus-visible:ring-[3px]" :class="{ 'bg-accent': i === activeIndex }" :aria-current="i === activeIndex ? 'true' : undefined" @click="emit('seek', c.startMs / 1000)">
          <span class="text-muted-foreground w-11 shrink-0 pt-px text-xs tabular-nums">{{ formatDuration(c.startMs / 1000) }}</span>
          <span class="leading-snug"><template v-for="(p, k) in parts(c.text)" :key="k"><mark v-if="p.hit" class="bg-secondary text-secondary-foreground rounded px-0.5">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template></span>
        </button>
      </li>
      <li v-if="visible.length === 0" class="text-muted-foreground px-2 py-4 text-center text-xs">Tidak ada yang cocok dengan "{{ query }}".</li>
    </ol>
  </div>
</template>
