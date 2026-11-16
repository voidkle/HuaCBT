<script setup lang="ts">
import { TrendingDown, TrendingUp } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatSummary } from "../types";

interface Props {
  stats: StatSummary[];
}
defineProps<Props>();

const formatChange = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("id-ID")}%`;
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Card v-for="stat in stats" :key="stat.key" class="gap-2 py-3">
      <CardHeader>
        <CardDescription>{{ stat.label }}</CardDescription>
        <CardTitle class="pt-1 text-2xl font-semibold tabular-nums">{{ stat.value }}</CardTitle>
        <CardAction>
          <Badge variant="secondary" class="bg-muted text-muted-foreground rounded-md px-1.5 text-[11px] font-medium">
            <TrendingUp v-if="stat.change >= 0" class="size-3" />
            <TrendingDown v-else class="size-3" />
            {{ formatChange(stat.change) }}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter class="text-muted-foreground text-xs">{{ stat.footnote }}</CardFooter>
    </Card>
  </div>
</template>
