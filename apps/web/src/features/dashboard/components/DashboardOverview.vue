<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "../composables/useDashboard";
import ActivityChart from "./ActivityChart.vue";
import StatCards from "./StatCards.vue";

const { data, loading, error, reload } = useDashboard();
</script>

<template>
  <div v-if="loading" class="flex flex-col gap-3" aria-busy="true">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Skeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
    </div>
    <Skeleton class="h-72 rounded-xl" />
  </div>

  <div v-else-if="error || !data" class="flex flex-col items-center gap-3 py-16 text-center" role="alert">
    <p class="text-destructive text-sm">{{ error ?? "Data tidak tersedia." }}</p>
    <Button variant="outline" @click="reload">Coba lagi</Button>
  </div>

  <div v-else class="flex flex-col gap-3">
    <StatCards :stats="data.stats" />
    <ActivityChart :activity="data.activity" />
  </div>
</template>
