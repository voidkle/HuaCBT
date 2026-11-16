<script setup lang="ts">
import { Plus, Users } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import type { ClassSummary } from "../types";

interface Props {
  items: ClassSummary[];
  selectedId: number | null;
  loading: boolean;
  error: string | null;
  canCreate: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ select: [id: number]; create: []; retry: [] }>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <Button v-if="canCreate" variant="outline" class="justify-start" @click="emit('create')"><Plus />Kelas baru</Button>

    <div v-if="loading" class="flex flex-col gap-2" aria-busy="true"><Skeleton v-for="i in 3" :key="i" class="h-14 rounded-xl" /></div>
    <div v-else-if="error" class="flex flex-col items-start gap-2" role="alert">
      <p class="text-destructive text-sm">{{ error }}</p>
      <Button variant="outline" size="sm" @click="emit('retry')">Coba lagi</Button>
    </div>
    <p v-else-if="items.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
      {{ canCreate ? "Belum ada kelas. Buat yang pertama." : "Belum ada kelas untuk Anda." }}
    </p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="c in items" :key="c.id">
        <button
          type="button"
          :aria-current="c.id === selectedId ? 'true' : undefined"
          :class="cn('bg-card focus-visible:ring-ring/50 flex w-full flex-col gap-1 rounded-xl border p-3 text-left shadow-xs outline-none focus-visible:ring-[3px]', c.id === selectedId ? 'border-primary' : 'hover:bg-accent')"
          @click="emit('select', c.id)"
        >
          <span class="truncate text-sm font-medium">{{ c.name }}<span v-if="c.grade" class="text-muted-foreground font-normal"> · Kelas {{ c.grade }}</span></span>
          <span class="text-muted-foreground flex items-center gap-1 text-xs">
            <Users class="size-3" aria-hidden="true" />{{ c.memberCount }} anggota · {{ c.system === "homeroom_teacher" ? "Guru kelas" : "Wali kelas" }}: {{ c.homeroomTeacherName ?? "belum ada" }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
