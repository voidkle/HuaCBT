<script setup lang="ts">
import { watchEffect } from "vue";
import { RouterView, useRoute } from "vue-router";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/composables/useTheme";
import { useBrandingStore } from "@/features/config/stores/useBrandingStore";

const { isDark } = useTheme();
const route = useRoute();
const branding = useBrandingStore();

// reactive, so saving a new site title on the config page updates the tab title immediately
watchEffect(() => {
  document.title = route.meta.title ? `${route.meta.title} · ${branding.siteTitle}` : branding.siteTitle;
});
</script>

<template>
  <RouterView />
  <Toaster position="top-right" :theme="isDark ? 'dark' : 'light'" />
</template>
