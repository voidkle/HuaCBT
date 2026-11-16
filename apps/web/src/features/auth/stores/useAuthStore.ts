import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { fetchMe, loginUrl, logoutUrl } from "../services/authApi";
import type { AuthUser, Role } from "../types";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const loaded = ref(false);

  const isLoggedIn = computed(() => user.value !== null);

  async function load() {
    if (loaded.value) return;
    user.value = await fetchMe();
    loaded.value = true;
  }

  const hasRole = (...roles: Role[]) => user.value !== null && roles.includes(user.value.role);
  const login = (returnTo?: string) => window.location.assign(loginUrl(returnTo));
  const logout = () => window.location.assign(logoutUrl());

  return { user, loaded, isLoggedIn, load, hasRole, login, logout };
});
