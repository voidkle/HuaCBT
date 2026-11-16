<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  submitting?: boolean;
  /** Red outline for irreversible deletes (default); false = a normal primary button (e.g. "Kumpulkan"). */
  destructive?: boolean;
}
withDefaults(defineProps<Props>(), { confirmLabel: "Hapus", submitting: false, destructive: true });
const emit = defineEmits<{ confirm: [] }>();
const open = defineModel<boolean>("open", { required: true });
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="submitting">Batal</AlertDialogCancel>
        <!-- outline + destructive text: the filled destructive button is unreadable in dark mode -->
        <Button :variant="destructive ? 'outline' : 'default'" :class="{ 'text-destructive border-destructive/40': destructive }" :disabled="submitting" @click="emit('confirm')">
          <Loader2 v-if="submitting" class="animate-spin" />
          {{ confirmLabel }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
