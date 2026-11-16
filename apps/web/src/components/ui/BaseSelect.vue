<script setup lang="ts">
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  placeholder?: string;
  label: string;
  disabled?: boolean;
}
withDefaults(defineProps<Props>(), { placeholder: "Pilih…", disabled: false });
const model = defineModel<string>({ required: true });
</script>

<template>
  <Select v-model="model" :disabled="disabled">
    <SelectTrigger class="w-full" :aria-label="label"><SelectValue :placeholder="placeholder" /></SelectTrigger>
    <SelectContent><SelectItem v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</SelectItem></SelectContent>
  </Select>
</template>
