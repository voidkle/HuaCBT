<script setup lang="ts">
import { computed } from "vue";
import { Moon, Sun } from "lucide-vue-next";
import { useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/composables/useTheme";

const route = useRoute();
const { isDark, toggle } = useTheme();

const title = computed(() => route.meta.title ?? "HuaEBL");
const themeLabel = computed(() => (isDark.value ? "Mode terang" : "Mode gelap"));
</script>

<template>
  <header class="flex h-12 shrink-0 items-center gap-2 px-4">
    <SidebarTrigger class="text-muted-foreground -ml-1 size-7" />
    <h1 class="text-[13px] font-medium">{{ title }}</h1>
    <Button variant="ghost" size="icon" class="text-muted-foreground ml-auto size-7" :aria-label="themeLabel" :title="themeLabel" @click="toggle">
      <Sun v-if="isDark" class="size-4" />
      <Moon v-else class="size-4" />
    </Button>
  </header>
</template>
