<script setup lang="ts">
import { Download, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/utils/formatBytes";
import { fileUrl } from "../services/assignmentsApi";
import type { FileInfo } from "../types";

interface Props {
  files: FileInfo[];
  /** Shows a remove button per file. */
  removable?: boolean;
  disabled?: boolean;
}
withDefaults(defineProps<Props>(), { removable: false, disabled: false });
const emit = defineEmits<{ remove: [file: FileInfo] }>();
</script>

<template>
  <ul v-if="files.length" class="bg-card divide-y rounded-lg border">
    <li v-for="f in files" :key="f.id" class="flex items-center gap-2 px-3 py-1.5 text-sm">
      <a :href="fileUrl(f.id)" class="hover:underline flex min-w-0 flex-1 items-center gap-2" :aria-label="`Unduh ${f.name}`">
        <Download class="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ f.name }}</span>
        <span class="text-muted-foreground shrink-0 text-xs">{{ formatBytes(f.size) }}</span>
      </a>
      <Button v-if="removable" variant="ghost" size="icon" :disabled="disabled" :aria-label="`Hapus ${f.name}`" @click="emit('remove', f)"><X /></Button>
    </li>
  </ul>
</template>
