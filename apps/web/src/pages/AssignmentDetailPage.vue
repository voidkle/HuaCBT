<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AssignmentDetailView from "@/features/assignments/components/AssignmentDetailView.vue";

const route = useRoute();
const id = computed(() => Number(route.params.id));
</script>

<template>
  <AssignmentDetailView :assignment-id="id" />
</template>
