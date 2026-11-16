<script setup lang="ts">
import { RouterLink } from "vue-router";
import { SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import type { NavItem } from "./navItems";

interface Props {
  item: NavItem;
  active: boolean;
  /** Unread-style count; hidden when 0. */
  badge?: number;
}
defineProps<Props>();

// white "pill" for the active item, muted icons otherwise
const itemClass =
  "[&>svg]:text-sidebar-foreground/60 data-[active=true]:[&>svg]:text-sidebar-foreground data-[active=true]:shadow-xs data-[active=true]:ring-1 data-[active=true]:ring-sidebar-border";
</script>

<template>
  <SidebarMenuItem>
    <SidebarMenuButton v-if="item.to" as-child :tooltip="item.title" :is-active="active" :class="itemClass">
      <RouterLink :to="item.to">
        <component :is="item.icon" />
        <span>{{ item.title }}</span>
      </RouterLink>
    </SidebarMenuButton>
    <SidebarMenuBadge v-if="item.to && badge" class="bg-primary text-primary-foreground rounded-full text-[10px]" :aria-label="`${badge} belum dibaca`">{{ badge > 99 ? "99+" : badge }}</SidebarMenuBadge>
    <template v-else-if="!item.to">
      <SidebarMenuButton disabled :tooltip="`${item.title} (segera)`" :class="[itemClass, 'opacity-60']">
        <component :is="item.icon" />
        <span>{{ item.title }}</span>
      </SidebarMenuButton>
      <SidebarMenuBadge class="text-[10px] opacity-70">Segera</SidebarMenuBadge>
    </template>
  </SidebarMenuItem>
</template>
