<script setup lang="ts">
interface Props {
  holder: string;
}
defineProps<Props>();

const year = new Date().getFullYear();
</script>

<template>
  <footer class="text-muted-foreground px-4 py-3 text-center text-[11px]">
    © {{ year }} {{ holder }}. Powered by huaEBL by ruthkle. All rights reserved.
  </footer>
</template>
