<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ExamEditorView from "@/features/cbt/components/ExamEditorView.vue";

const route = useRoute();
const id = computed(() => Number(route.params.id));
</script>

<template>
  <ExamEditorView :key="id" :exam-id="id" />
</template>
