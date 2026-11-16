<script setup lang="ts">
import { RouterView } from "vue-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useChatConnection } from "@/features/chat/composables/useChatConnection";
import { useBrandingStore } from "@/features/config/stores/useBrandingStore";
import AppFooter from "./AppFooter.vue";
import AppHeader from "./AppHeader.vue";
import AppSidebar from "./AppSidebar.vue";

const branding = useBrandingStore();
useChatConnection(); // live chat events + unread badge while signed in
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <AppHeader />
      <main class="flex flex-1 flex-col gap-4 px-4 pb-4">
        <RouterView />
      </main>
      <AppFooter :holder="branding.copyrightHolder" />
    </SidebarInset>
  </SidebarProvider>
</template>
