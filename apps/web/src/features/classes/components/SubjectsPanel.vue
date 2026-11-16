<script setup lang="ts">
import { ref } from "vue";
import { Check, Pencil, Plus, Trash2, X } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Subject } from "../types";

interface Props {
  items: Subject[];
  busy: boolean;
}
defineProps<Props>();
const emit = defineEmits<{ add: [name: string]; rename: [id: number, name: string]; remove: [id: number] }>();

const draft = ref("");
const editingId = ref<number | null>(null);
const editName = ref("");
const removing = ref<Subject | null>(null);

function add() {
  if (draft.value.trim()) (emit("add", draft.value.trim()), (draft.value = ""));
}
function startEdit(s: Subject) {
  editingId.value = s.id;
  editName.value = s.name;
}
function saveEdit() {
  if (editingId.value !== null && editName.value.trim()) emit("rename", editingId.value, editName.value.trim());
  editingId.value = null;
}
function confirmRemove() {
  if (removing.value) emit("remove", removing.value.id);
  removing.value = null;
}
</script>

<template>
  <section class="flex flex-col gap-2" aria-labelledby="mapel-h">
    <h3 id="mapel-h" class="text-sm font-medium">Mata pelajaran</h3>
    <form class="flex gap-2" @submit.prevent="add">
      <Input v-model="draft" maxlength="80" placeholder="mis. Matematika" aria-label="Nama mata pelajaran baru" autocomplete="off" />
      <Button type="submit" variant="outline" :disabled="busy || !draft.trim()"><Plus />Tambah</Button>
    </form>
    <p v-if="items.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">Belum ada mata pelajaran.</p>
    <ul v-else class="bg-card divide-y rounded-xl border shadow-xs">
      <li v-for="s in items" :key="s.id" class="flex items-center gap-2 px-3 py-1.5">
        <form v-if="editingId === s.id" class="flex flex-1 gap-1" @submit.prevent="saveEdit">
          <Input v-model="editName" maxlength="80" :aria-label="`Nama baru untuk ${s.name}`" autocomplete="off" />
          <Button type="submit" variant="ghost" size="icon" aria-label="Simpan nama"><Check /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Batal" @click="editingId = null"><X /></Button>
        </form>
        <template v-else>
          <span class="flex-1 truncate text-sm">{{ s.name }}</span>
          <Button variant="ghost" size="icon" :aria-label="`Ubah nama ${s.name}`" @click="startEdit(s)"><Pencil /></Button>
          <Button variant="ghost" size="icon" :aria-label="`Hapus ${s.name}`" @click="removing = s"><Trash2 /></Button>
        </template>
      </li>
    </ul>
    <BaseConfirmDialog
      :open="removing !== null"
      title="Hapus mata pelajaran?"
      :description="`&quot;${removing?.name ?? ''}&quot; dihapus dari semua kelas, beserta jam pelajarannya.`"
      :submitting="busy"
      @update:open="(v: boolean) => !v && (removing = null)"
      @confirm="confirmRemove"
    />
  </section>
</template>
