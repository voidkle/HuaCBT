<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import ChatView from "@/features/chat/components/ChatView.vue";

const route = useRoute();
const roomId = computed(() => {
  const n = Number(route.params.roomId);
  return Number.isInteger(n) && n > 0 ? n : null;
});
</script>

<template>
  <ChatView :room-id="roomId" />
</template>
