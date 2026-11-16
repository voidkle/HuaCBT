<script setup lang="ts">
import { VisArea, VisAxis, VisXYContainer } from "@unovis/vue";
import { computed, ref } from "vue";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActivityPoint } from "../types";

interface Props {
  activity: ActivityPoint[];
}
const props = defineProps<Props>();

const ranges = [
  { value: "90", label: "3 bulan terakhir" },
  { value: "30", label: "30 hari terakhir" },
  { value: "7", label: "7 hari terakhir" },
] as const;

const chartConfig = {
  attendance: { label: "Kehadiran", color: "var(--chart-2)" },
  logins: { label: "Login", color: "var(--chart-1)" },
} satisfies ChartConfig;

type Point = { date: Date; attendance: number; logins: number };

const range = ref<string>("90");

const points = computed<Point[]>(() =>
  props.activity.slice(-Number(range.value)).map((p) => ({ ...p, date: new Date(p.date) })),
);

const dateLabel = (d: number | Date) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const tooltipTemplate = componentToString(chartConfig, ChartTooltipContent, { labelFormatter: dateLabel });
const colors = [chartConfig.attendance.color, chartConfig.logins.color];
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Aktivitas Pengguna</CardTitle>
      <CardDescription>Kehadiran dan login harian</CardDescription>
      <CardAction>
        <Select v-model="range">
          <SelectTrigger size="sm" class="w-36 text-xs" aria-label="Rentang waktu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="r in ranges" :key="r.value" :value="r.value">{{ r.label }}</SelectItem>
          </SelectContent>
        </Select>
      </CardAction>
    </CardHeader>
    <CardContent>
      <p v-if="points.length === 0" class="text-muted-foreground py-16 text-center text-sm">Belum ada data aktivitas.</p>
      <ChartContainer v-else :config="chartConfig" class="aspect-auto h-[220px] w-full" :cursor="false">
        <VisXYContainer :data="points" :margin="{ left: -40 }" :y-domain="[0, undefined]">
          <VisArea :x="(d: Point) => d.date" :y="[(d: Point) => d.attendance, (d: Point) => d.logins]" :color="(_d: Point, i: number) => colors[i]" :opacity="0.35" />
          <VisAxis type="x" :x="(d: Point) => d.date" :tick-line="false" :domain-line="false" :grid-line="false" :num-ticks="6" :tick-format="dateLabel" />
          <VisAxis type="y" :num-ticks="3" :tick-line="false" :domain-line="false" />
          <ChartTooltip />
          <ChartCrosshair :template="tooltipTemplate" :color="colors" />
        </VisXYContainer>
      </ChartContainer>
    </CardContent>
  </Card>
</template>
