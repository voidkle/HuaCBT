<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Check, Loader2, Search } from "lucide-vue-next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/composables/useToast";
import { roleLabels } from "@/features/auth/types";
import { initials } from "@/utils/initials";
import { createGroup, openDirectRoom, searchUsers } from "../services/chatApi";
import { useChatStore } from "../stores/useChatStore";
import type { ChatUser, Room } from "../types";

const emit = defineEmits<{ created: [room: Room] }>();
const open = defineModel<boolean>("open", { required: true });

const chat = useChatStore();
const toast = useToast();

const mode = ref<"direct" | "group">("direct");
const query = ref("");
const results = ref<ChatUser[]>([]);
const searching = ref(false);
const picked = ref<ChatUser[]>([]);
const groupName = ref("");
const submitting = ref(false);

const canCreateGroup = computed(() => groupName.value.trim() !== "" && picked.value.length > 0 && !submitting.value);
const isPicked = (u: ChatUser) => picked.value.some((p) => p.id === u.id);

let timer: ReturnType<typeof setTimeout> | undefined;
let token = 0;
async function runSearch() {
  const mine = ++token;
  searching.value = true;
  try {
    const found = await searchUsers(query.value);
    if (mine === token) results.value = found;
  } catch (e) {
    if (mine === token) toast.error(e instanceof Error ? e.message : "Gagal mencari pengguna");
  } finally {
    if (mine === token) searching.value = false;
  }
}
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 250);
});
watch(open, (isOpen) => {
  if (!isOpen) return;
  mode.value = "direct";
  query.value = "";
  picked.value = [];
  groupName.value = "";
  void runSearch();
});
onBeforeUnmount(() => clearTimeout(timer));

async function finish(request: () => Promise<Room>) {
  submitting.value = true;
  try {
    const room = await request();
    chat.upsertRoom(room);
    open.value = false;
    emit("created", room);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Gagal membuat chat");
  } finally {
    submitting.value = false;
  }
}

function choose(u: ChatUser) {
  if (mode.value === "direct") return void finish(() => openDirectRoom(u.id));
  picked.value = isPicked(u) ? picked.value.filter((p) => p.id !== u.id) : [...picked.value, u];
}
const createNewGroup = () => finish(() => createGroup(groupName.value.trim(), picked.value.map((p) => p.id)));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Chat baru</DialogTitle>
        <DialogDescription>{{ mode === "direct" ? "Pilih orang untuk memulai percakapan." : "Beri nama grup dan pilih anggotanya." }}</DialogDescription>
      </DialogHeader>

      <Tabs v-model="mode">
        <TabsList class="w-full">
          <TabsTrigger value="direct">Pesan langsung</TabsTrigger>
          <TabsTrigger value="group">Grup</TabsTrigger>
        </TabsList>
      </Tabs>

      <div v-if="mode === 'group'" class="flex flex-col gap-1.5">
        <Label for="group-name">Nama grup</Label>
        <Input id="group-name" v-model="groupName" maxlength="80" autocomplete="off" />
        <div v-if="picked.length" class="flex flex-wrap gap-1 pt-1">
          <button v-for="p in picked" :key="p.id" type="button" class="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs" :aria-label="`Keluarkan ${p.name}`" @click="choose(p)">{{ p.name }} <span aria-hidden="true">×</span></button>
        </div>
      </div>

      <div class="relative">
        <Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input v-model="query" placeholder="Cari nama…" class="pl-9" aria-label="Cari nama" autocomplete="off" />
      </div>

      <div class="min-h-24">
        <div v-if="searching && results.length === 0" class="flex justify-center py-6"><Loader2 class="text-muted-foreground size-5 animate-spin" /></div>
        <p v-else-if="results.length === 0" class="text-muted-foreground py-6 text-center text-sm">Tidak ada pengguna yang cocok.</p>
        <ul v-else class="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
          <li v-for="u in results" :key="u.id">
            <button type="button" class="hover:bg-accent flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors" :disabled="submitting" @click="choose(u)">
              <Avatar class="size-8"><AvatarFallback class="bg-secondary text-secondary-foreground text-[11px]">{{ initials(u.name) }}</AvatarFallback></Avatar>
              <span class="flex min-w-0 flex-1 flex-col leading-tight">
                <span class="truncate text-[13px] font-medium">{{ u.name }}</span>
                <span class="text-muted-foreground text-xs">{{ roleLabels[u.role] }}</span>
              </span>
              <Check v-if="mode === 'group' && isPicked(u)" class="text-primary size-4 shrink-0" />
            </button>
          </li>
        </ul>
      </div>

      <DialogFooter v-if="mode === 'group'">
        <Button type="button" variant="outline" :disabled="submitting" @click="open = false">Batal</Button>
        <Button type="button" :disabled="!canCreateGroup" @click="createNewGroup">
          <Loader2 v-if="submitting" class="animate-spin" />
          Buat grup ({{ picked.length }})
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
