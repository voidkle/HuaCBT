<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ExamPlayerView from "@/features/cbt/components/ExamPlayerView.vue";

const route = useRoute();
const id = computed(() => Number(route.params.id));
</script>

<template>
  <ExamPlayerView :key="id" :attempt-id="id" />
</template>
