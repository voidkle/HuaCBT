<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Loader2, Plus, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePeopleSearch } from "../composables/usePeopleSearch";
import type { ClassroomDetail, ClassroomInput, Person } from "../types";

interface Props {
  /** null = a new class. */
  classroom: ClassroomDetail | null;
  submitting: boolean;
}
const props = defineProps<Props>();
const emit = defineEmits<{ submit: [input: ClassroomInput] }>();
const open = defineModel<boolean>("open", { required: true });

const roleLabel = { student: "Siswa", teacher: "Guru" } as const;
const name = ref("");
const members = ref<Person[]>([]);
const { query, results, loading, error, run } = usePeopleSearch();

const chosen = computed(() => new Set(members.value.map((m) => m.id)));
const candidates = computed(() => results.value.filter((p) => !chosen.value.has(p.id)));
const valid = computed(() => name.value.trim() !== "");

watch(open, (isOpen) => {
  if (!isOpen) return;
  name.value = props.classroom?.name ?? "";
  members.value = [...(props.classroom?.members ?? [])];
  query.value = "";
  void run();
});

const add = (p: Person) => members.value.push(p);
const drop = (id: number) => (members.value = members.value.filter((m) => m.id !== id));
const submit = () => valid.value && emit("submit", { name: name.value.trim(), memberIds: members.value.map((m) => m.id) });
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ classroom ? "Ubah kelas" : "Kelas baru" }}</DialogTitle>
        <DialogDescription>Anggota (siswa atau guru) dapat presensi pada sesi kelas ini.</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <Label for="class-name">Nama kelas</Label>
          <Input id="class-name" v-model="name" maxlength="80" placeholder="mis. X IPA 1" autocomplete="off" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Anggota ({{ members.length }})</Label>
          <ul v-if="members.length" class="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            <li v-for="m in members" :key="m.id" class="bg-muted flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs">
              {{ m.name }}
              <button type="button" class="hover:bg-background rounded-full p-0.5" :aria-label="`Keluarkan ${m.name}`" @click="drop(m.id)"><X class="size-3" /></button>
            </li>
          </ul>
          <p v-else class="text-muted-foreground text-xs">Belum ada anggota.</p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="class-search">Tambah anggota</Label>
          <Input id="class-search" v-model="query" type="search" placeholder="Cari nama atau username" autocomplete="off" />
          <p v-if="error" class="text-destructive text-xs" role="alert">{{ error }}</p>
          <ul class="max-h-44 divide-y overflow-y-auto rounded-lg border" :aria-busy="loading">
            <li v-for="p in candidates" :key="p.id" class="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span class="min-w-0 flex-1 truncate">{{ p.name }} <span class="text-muted-foreground text-xs">@{{ p.username }} · {{ roleLabel[p.role as keyof typeof roleLabel] ?? p.role }}</span></span>
              <Button type="button" variant="ghost" size="icon" :aria-label="`Tambahkan ${p.name}`" @click="add(p)"><Plus /></Button>
            </li>
            <li v-if="!loading && candidates.length === 0" class="text-muted-foreground px-3 py-3 text-center text-xs">Tidak ada hasil.</li>
          </ul>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
          <Button type="submit" :disabled="!valid || submitting">
            <Loader2 v-if="submitting" class="animate-spin" />
            Simpan
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
