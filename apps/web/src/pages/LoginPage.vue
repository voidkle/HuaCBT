<script setup lang="ts">
import { GraduationCap } from "lucide-vue-next";
import { useRoute } from "vue-router";
import AppFooter from "@/components/layout/AppFooter.vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useBrandingStore } from "@/features/config/stores/useBrandingStore";

const auth = useAuthStore();
const branding = useBrandingStore();
const route = useRoute();
const failed = route.query.sso_error !== undefined;
</script>

<template>
  <div class="bg-sidebar flex min-h-svh flex-col">
    <main class="flex flex-1 items-center justify-center p-4">
      <Card class="w-full max-w-sm gap-4 py-6">
        <CardHeader class="items-center text-center">
          <img v-if="branding.logoSrc" :src="branding.logoSrc" :alt="branding.siteTitle" class="mb-2 size-12 rounded-lg object-contain" />
          <div v-else class="bg-primary text-primary-foreground mb-2 flex size-12 items-center justify-center rounded-lg">
            <GraduationCap class="size-6" />
          </div>
          <CardTitle class="text-base">{{ branding.siteTitle }}</CardTitle>
          <CardDescription>Masuk dengan akun TekSso kamu.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
          <p v-if="failed" class="text-destructive text-sm" role="alert">Login gagal. Coba lagi.</p>
          <Button class="w-full" @click="auth.login('/')">Masuk dengan TekSso</Button>
        </CardContent>
      </Card>
    </main>
    <AppFooter :holder="branding.copyrightHolder" />
  </div>
</template>
