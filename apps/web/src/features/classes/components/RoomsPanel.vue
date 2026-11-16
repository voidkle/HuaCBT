<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, Pencil, Plus, Trash2, X } from "lucide-vue-next";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Room, Teacher } from "../types";

interface Props {
  items: Room[];
  teachers: Teacher[];
  busy: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ add: [name: string, ownerId: number | null]; edit: [id: number, name: string, ownerId: number | null]; remove: [id: number] }>();

const SHARED = "shared";
const draft = ref("");
const draftOwner = ref(SHARED);
const editingId = ref<number | null>(null);
const editName = ref("");
const editOwner = ref(SHARED);
const removing = ref<Room | null>(null);

const ownerOptions = computed(() => [{ value: SHARED, label: "Ruang bersama" }, ...props.teachers.map((t) => ({ value: String(t.id), label: `Ruang ${t.name}` }))]);
const ownerOf = (v: string) => (v === SHARED ? null : Number(v));

function add() {
  if (!draft.value.trim()) return;
  emit("add", draft.value.trim(), ownerOf(draftOwner.value));
  draft.value = "";
  draftOwner.value = SHARED;
}
function startEdit(r: Room) {
  editingId.value = r.id;
  editName.value = r.name;
  editOwner.value = r.ownerId ? String(r.ownerId) : SHARED;
}
function saveEdit() {
  if (editingId.value !== null && editName.value.trim()) emit("edit", editingId.value, editName.value.trim(), ownerOf(editOwner.value));
  editingId.value = null;
}
function confirmRemove() {
  if (removing.value) emit("remove", removing.value.id);
  removing.value = null;
}
</script>

<template>
  <section class="flex flex-col gap-2" aria-labelledby="ruang-h">
    <h3 id="ruang-h" class="text-sm font-medium">Ruang</h3>
    <p class="text-muted-foreground text-xs">Untuk sistem moving class: ruang mata pelajaran (mis. Lab Biologi) atau ruang milik seorang guru.</p>
    <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="add">
      <Input v-model="draft" maxlength="80" placeholder="mis. Lab Biologi" aria-label="Nama ruang baru" autocomplete="off" />
      <div class="sm:w-56"><BaseSelect v-model="draftOwner" :options="ownerOptions" label="Pemilik ruang baru" /></div>
      <Button type="submit" variant="outline" :disabled="busy || !draft.trim()"><Plus />Tambah</Button>
    </form>
    <p v-if="items.length === 0" class="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">Belum ada ruang. Tanpa ruang, siswa tetap di kelasnya dan guru yang berpindah.</p>
    <ul v-else class="bg-card divide-y rounded-xl border shadow-xs">
      <li v-for="r in items" :key="r.id" class="flex items-center gap-2 px-3 py-1.5">
        <form v-if="editingId === r.id" class="flex flex-1 flex-col gap-1 sm:flex-row" @submit.prevent="saveEdit">
          <Input v-model="editName" maxlength="80" :aria-label="`Nama baru untuk ${r.name}`" autocomplete="off" />
          <div class="sm:w-56"><BaseSelect v-model="editOwner" :options="ownerOptions" :label="`Pemilik ${r.name}`" /></div>
          <span class="flex gap-1">
            <Button type="submit" variant="ghost" size="icon" aria-label="Simpan ruang"><Check /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Batal" @click="editingId = null"><X /></Button>
          </span>
        </form>
        <template v-else>
          <span class="min-w-0 flex-1">
            <span class="text-sm">{{ r.name }}</span>
            <span class="text-muted-foreground block truncate text-xs">{{ r.ownerName ? `Ruang ${r.ownerName}` : "Ruang bersama" }}</span>
          </span>
          <Button variant="ghost" size="icon" :aria-label="`Ubah ${r.name}`" @click="startEdit(r)"><Pencil /></Button>
          <Button variant="ghost" size="icon" :aria-label="`Hapus ${r.name}`" @click="removing = r"><Trash2 /></Button>
        </template>
      </li>
    </ul>
    <BaseConfirmDialog
      :open="removing !== null"
      title="Hapus ruang?"
      :description="`&quot;${removing?.name ?? ''}&quot; dihapus. Pelajaran yang memakainya kembali berlangsung di kelas masing-masing.`"
      :submitting="busy"
      @update:open="(v: boolean) => !v && (removing = null)"
      @confirm="confirmRemove"
    />
  </section>
</template>
