<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BODY_MAX, type Notice, type NoticeInput, TITLE_MAX } from "../types";

interface Props {
  /** The notice being edited, or null when creating. */
  notice: Notice | null;
  submitting: boolean;
  /** Student/teacher posts wait for staff approval; show a hint instead of promising publication. */
  needsApproval: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ submit: [input: NoticeInput] }>();
const open = defineModel<boolean>("open", { required: true });

const title = ref("");
const body = ref("");

const valid = computed(() => title.value.trim() !== "" && body.value.trim() !== "");
const heading = computed(() => (props.notice ? "Ubah pengumuman" : "Pengumuman baru"));

watch(open, (isOpen) => {
  if (!isOpen) return;
  title.value = props.notice?.title ?? "";
  body.value = props.notice?.body ?? "";
});

function submit() {
  if (valid.value && !props.submitting) emit("submit", { title: title.value.trim(), body: body.value.trim() });
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>{{ heading }}</DialogTitle>
          <DialogDescription>
            {{ needsApproval ? "Pengumuman akan tampil di mading setelah disetujui staf." : "Pengumuman langsung tampil di mading." }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-1.5">
          <Label for="notice-title">Judul</Label>
          <Input id="notice-title" v-model="title" :maxlength="TITLE_MAX" required autocomplete="off" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="notice-body">Isi</Label>
          <Textarea id="notice-body" v-model="body" :maxlength="BODY_MAX" rows="6" required class="md:text-[13px]" />
          <p class="text-muted-foreground text-right text-xs">{{ body.length }} / {{ BODY_MAX }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting">
            <Loader2 v-if="submitting" class="animate-spin" />
            {{ notice ? "Simpan" : needsApproval ? "Kirim" : "Publikasikan" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
