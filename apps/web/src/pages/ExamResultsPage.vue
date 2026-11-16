<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ExamResultsView from "@/features/cbt/components/ExamResultsView.vue";

const route = useRoute();
const id = computed(() => Number(route.params.id));
</script>

<template>
  <ExamResultsView :key="id" :exam-id="id" />
</template>
