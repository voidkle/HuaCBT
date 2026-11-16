<script setup lang="ts">
import { ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  videoTitle: string;
  submitting: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ confirm: [note: string] }>();
const open = defineModel<boolean>("open", { required: true });

const note = ref("");
watch(open, (isOpen) => {
  if (isOpen) note.value = "";
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <form class="flex flex-col gap-4" @submit.prevent="emit('confirm', note.trim())">
        <DialogHeader>
          <DialogTitle>Tolak video</DialogTitle>
          <DialogDescription>"{{ videoTitle }}" tidak akan tampil untuk siswa lain. Pengunggah dapat melihat catatanmu.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-1.5">
          <Label for="video-reject-note">Alasan (opsional)</Label>
          <Textarea id="video-reject-note" v-model="note" maxlength="300" rows="3" class="md:text-[13px]" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="submitting"><Loader2 v-if="submitting" class="animate-spin" />Tolak</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
