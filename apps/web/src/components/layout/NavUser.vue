<script setup lang="ts">
import { computed } from "vue";
import { ChevronsUpDown, LogOut } from "lucide-vue-next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { roleLabels } from "@/features/auth/types";
import { initials } from "@/utils/initials";

const auth = useAuthStore();

const name = computed(() => auth.user?.name ?? "");
const role = computed(() => (auth.user ? roleLabels[auth.user.role] : ""));
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton class="h-10 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <Avatar class="size-6">
              <AvatarFallback class="bg-sidebar-primary text-sidebar-primary-foreground text-[10px]">{{ initials(name) }}</AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left leading-tight">
              <span class="truncate text-[13px] font-medium">{{ name }}</span>
              <span class="text-sidebar-foreground/60 truncate text-[11px]">{{ role }}</span>
            </div>
            <ChevronsUpDown class="text-sidebar-foreground/60 ml-auto size-3.5" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-(--reka-dropdown-menu-trigger-width) min-w-52 rounded-lg" side="bottom" align="start" :side-offset="4">
          <DropdownMenuLabel class="font-normal">
            <p class="truncate text-[13px] font-medium">{{ name }}</p>
            <p class="text-muted-foreground truncate text-xs">{{ auth.user?.email ?? auth.user?.username }}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="auth.logout">
            <LogOut />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
