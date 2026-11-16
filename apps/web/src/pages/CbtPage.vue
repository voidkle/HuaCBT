<script setup lang="ts">
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import AvailableExamList from "@/features/cbt/components/AvailableExamList.vue";
import ManagedExamList from "@/features/cbt/components/ManagedExamList.vue";

const auth = useAuthStore();
</script>

<template>
  <AvailableExamList v-if="auth.hasRole('student')" />
  <ManagedExamList v-else-if="auth.hasRole('admin', 'operator', 'teacher')" />
  <p v-else class="text-muted-foreground rounded-xl border border-dashed py-16 text-center text-sm">Ujian (CBT) tersedia untuk guru dan siswa.</p>
</template>
