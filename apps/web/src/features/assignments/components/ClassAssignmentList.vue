<script setup lang="ts">
import { toRef } from "vue";
import { RouterLink } from "vue-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignments } from "../composables/useAssignments";
import AssignmentRow from "./AssignmentRow.vue";

interface Props {
  classroomId: number;
}
const props = defineProps<Props>();

const a = useAssignments(toRef(() => props.classroomId));
</script>

<template>
  <section class="flex flex-col gap-2" aria-labelledby="class-as-h">
    <div class="flex items-center gap-2">
      <h3 id="class-as-h" class="text-sm font-medium">Tugas</h3>
      <RouterLink to="/assignments" class="text-muted-foreground hover:text-foreground ml-auto text-xs underline">Semua tugas</RouterLink>
    </div>
    <Skeleton v-if="a.loading.value" class="h-14 rounded-xl" aria-busy="true" />
    <p v-else-if="a.error.value" class="text-destructive text-xs" role="alert">{{ a.error.value }}</p>
    <p v-else-if="a.items.value.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">Belum ada tugas untuk kelas ini.</p>
    <div v-else class="flex flex-col gap-2">
      <AssignmentRow v-for="item in a.upcoming.value.concat(a.past.value).slice(0, 5)" :key="item.id" :item="item" />
    </div>
  </section>
</template>
