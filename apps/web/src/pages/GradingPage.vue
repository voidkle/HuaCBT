<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import GradingView from "@/features/cbt/components/GradingView.vue";

const route = useRoute();
const id = computed(() => Number(route.params.id));
</script>

<template>
  <GradingView :key="id" :attempt-id="id" />
</template>
