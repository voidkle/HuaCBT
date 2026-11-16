<script setup lang="ts">
import { computed, ref } from "vue";
import { Link2, Loader2, Presentation as PresentationIcon, Trash2, TriangleAlert } from "lucide-vue-next";
import { RouterLink } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/utils/formatBytes";
import { coverUrl } from "../services/presentationApi";
import { kindLabels, type Presentation } from "../types";

interface Props {
  deck: Presentation;
  canDelete: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ delete: [deck: Presentation] }>();

const coverFailed = ref(false);
const to = computed(() => `/presentations/${props.deck.id}`);
const openable = computed(() => props.deck.status !== "failed");
const percent = computed(() => (props.deck.progressPage && props.deck.pageCount ? Math.min(100, Math.round((props.deck.progressPage / props.deck.pageCount) * 100)) : 0));
const meta = computed(() => [props.deck.pageCount ? `${props.deck.pageCount} slide` : null, props.deck.kind === "file" ? formatBytes(props.deck.sizeBytes) : kindLabels[props.deck.kind], props.deck.uploader?.name].filter(Boolean).join(" · "));
const action = computed(() => (props.deck.progressPage ? `Lanjutkan slide ${props.deck.progressPage}` : "Buka"));
</script>

<template>
  <article class="bg-card flex flex-col overflow-hidden rounded-xl border shadow-xs">
    <component :is="openable ? RouterLink : 'div'" :to="openable ? to : undefined" class="focus-visible:ring-ring/50 block outline-none focus-visible:ring-[3px]" :aria-label="openable ? `Buka ${deck.title}` : undefined">
      <div class="bg-muted relative aspect-video overflow-hidden">
        <img v-if="deck.hasCover && !coverFailed && deck.status === 'ready'" :src="coverUrl(deck.id)" :alt="`Slide pertama ${deck.title}`" loading="lazy" class="size-full object-cover" @error="coverFailed = true" />
        <div v-else class="flex size-full flex-col items-center justify-center gap-1.5">
          <Loader2 v-if="deck.status === 'converting'" class="text-muted-foreground size-6 animate-spin" />
          <TriangleAlert v-else-if="deck.status === 'failed'" class="text-destructive size-6" />
          <Link2 v-else-if="deck.kind !== 'file'" class="text-muted-foreground size-6" />
          <PresentationIcon v-else class="text-muted-foreground size-6" />
          <span v-if="deck.status === 'converting'" class="text-muted-foreground text-xs" role="status">Mengonversi…</span>
        </div>
        <Badge v-if="deck.kind !== 'file'" variant="secondary" class="absolute top-2 left-2 text-[11px]">{{ kindLabels[deck.kind] }}</Badge>
        <div v-if="percent > 0" class="absolute inset-x-0 bottom-0 h-1 bg-black/15" role="progressbar" :aria-valuenow="percent" :aria-valuemin="0" :aria-valuemax="100" :aria-label="`Dilihat ${percent}%`">
          <div class="bg-primary h-full" :style="{ width: `${percent}%` }" />
        </div>
      </div>
    </component>

    <div class="flex flex-1 flex-col gap-1 p-3">
      <h3 class="line-clamp-2 text-[13px] leading-snug font-medium">{{ deck.title }}</h3>
      <p v-if="deck.status === 'failed'" class="text-destructive line-clamp-3 text-xs" role="alert">{{ deck.failureReason ?? "Konversi gagal." }}</p>
      <p v-else-if="deck.description" class="text-muted-foreground line-clamp-2 text-xs">{{ deck.description }}</p>
      <p class="text-muted-foreground mt-auto pt-1 text-[11px]">{{ meta }}</p>
      <div class="flex items-center gap-1.5 pt-1.5">
        <Button v-if="openable" as-child size="sm" class="min-w-0 flex-1"><RouterLink :to="to" class="truncate">{{ action }}</RouterLink></Button>
        <Button v-if="canDelete" size="icon" variant="ghost" class="text-muted-foreground size-8 shrink-0" :class="{ 'ml-auto': !openable }" :aria-label="`Hapus ${deck.title}`" @click="emit('delete', deck)"><Trash2 class="size-3.5" /></Button>
      </div>
    </div>
  </article>
</template>
