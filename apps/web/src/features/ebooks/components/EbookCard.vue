<script setup lang="ts">
import { computed, ref } from "vue";
import { BookOpen, Trash2 } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/utils/formatBytes";
import { coverUrl } from "../services/ebookApi";
import type { Ebook } from "../types";

interface Props {
  ebook: Ebook;
  canDelete: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ delete: [ebook: Ebook] }>();

const coverFailed = ref(false);
const to = computed(() => `/ebooks/${props.ebook.id}`);
const percent = computed(() => (props.ebook.progressPage ? Math.min(100, Math.round((props.ebook.progressPage / props.ebook.pageCount) * 100)) : 0));
const meta = computed(() => [`${props.ebook.pageCount} hal.`, formatBytes(props.ebook.sizeBytes), props.ebook.uploader?.name].filter(Boolean).join(" · "));
</script>

<template>
  <article class="bg-card flex flex-col overflow-hidden rounded-xl border shadow-xs">
    <RouterLink :to="to" class="focus-visible:ring-ring/50 block outline-none focus-visible:ring-[3px]" :aria-label="`Buka ${ebook.title}`">
      <div class="bg-muted relative aspect-[3/4] overflow-hidden">
        <img v-if="ebook.hasCover && !coverFailed" :src="coverUrl(ebook.id)" :alt="`Sampul ${ebook.title}`" loading="lazy" class="size-full object-cover" @error="coverFailed = true" />
        <div v-else class="flex size-full items-center justify-center"><BookOpen class="text-muted-foreground size-8" /></div>
        <div v-if="percent > 0" class="absolute inset-x-0 bottom-0 h-1 bg-black/15" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100" :aria-label="`Terbaca ${percent}%`">
          <div class="bg-primary h-full" :style="{ width: `${percent}%` }" />
        </div>
      </div>
    </RouterLink>

    <div class="flex flex-1 flex-col gap-1 p-3">
      <h3 class="line-clamp-2 text-[13px] leading-snug font-medium">{{ ebook.title }}</h3>
      <p v-if="ebook.description" class="text-muted-foreground line-clamp-2 text-xs">{{ ebook.description }}</p>
      <p class="text-muted-foreground mt-auto pt-1 text-[11px]">{{ meta }}</p>
      <div class="flex items-center gap-1.5 pt-1.5">
        <Button as-child size="sm" class="min-w-0 flex-1">
          <RouterLink :to="to" class="truncate">{{ ebook.progressPage ? `Lanjutkan hal. ${ebook.progressPage}` : "Baca" }}</RouterLink>
        </Button>
        <Button v-if="canDelete" size="icon" variant="ghost" class="text-muted-foreground size-8 shrink-0" :aria-label="`Hapus ${ebook.title}`" @click="emit('delete', ebook)">
          <Trash2 class="size-3.5" />
        </Button>
      </div>
    </div>
  </article>
</template>
