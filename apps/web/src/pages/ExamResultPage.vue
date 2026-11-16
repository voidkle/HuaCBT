<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ExamResultView from "@/features/cbt/components/ExamResultView.vue";

const route = useRoute();
const id = computed(() => Number(route.params.id));
</script>

<template>
  <ExamResultView :key="id" :attempt-id="id" />
</template>
