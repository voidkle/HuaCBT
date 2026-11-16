<script setup lang="ts">
import { computed } from "vue";
import { GraduationCap } from "lucide-vue-next";
import { useRoute } from "vue-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useChatStore } from "@/features/chat/stores/useChatStore";
import { useBrandingStore } from "@/features/config/stores/useBrandingStore";
import NavMenuItem from "./NavMenuItem.vue";
import NavUser from "./NavUser.vue";
import { footerItems, type NavItem, navGroups } from "./navItems";

const route = useRoute();
const auth = useAuthStore();
const branding = useBrandingStore();
const chat = useChatStore();

const visible = (items: NavItem[]) => items.filter((i) => !i.roles || auth.hasRole(...i.roles));
const groups = computed(() => navGroups.map((g) => ({ ...g, items: visible(g.items) })).filter((g) => g.items.length > 0));
const footer = computed(() => visible(footerItems));

const isActive = (item: NavItem) => !!item.to && (route.path === item.to || (item.to !== "/" && route.path.startsWith(`${item.to}/`)));
const badgeOf = (item: NavItem) => (item.badgeKey === "chat" ? chat.totalUnread : 0);
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader class="gap-2">
      <div class="flex items-center gap-2 px-2 pt-1 group-data-[collapsible=icon]:px-0">
        <img v-if="branding.logoSrc" :src="branding.logoSrc" :alt="branding.siteTitle" class="size-6 shrink-0 rounded-md object-contain" />
        <div v-else class="bg-sidebar-primary text-sidebar-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md">
          <GraduationCap class="size-3.5" />
        </div>
        <span class="truncate text-[13px] font-semibold group-data-[collapsible=icon]:hidden">{{ branding.siteTitle }}</span>
      </div>
      <NavUser />
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup v-for="group in groups" :key="group.label">
        <SidebarGroupLabel class="text-[11px]">{{ group.label }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <NavMenuItem v-for="item in group.items" :key="item.title" :item="item" :active="isActive(item)" :badge="badgeOf(item)" />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter v-if="footer.length">
      <SidebarMenu>
        <NavMenuItem v-for="item in footer" :key="item.title" :item="item" :active="isActive(item)" />
      </SidebarMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
