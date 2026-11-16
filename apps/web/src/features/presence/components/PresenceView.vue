<script setup lang="ts">
import { computed, ref } from "vue";
import BaseConfirmDialog from "@/components/ui/BaseConfirmDialog.vue";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCheckIn } from "../composables/useCheckIn";
import { useClassrooms } from "../composables/useClassrooms";
import { usePasskeys } from "../composables/usePasskeys";
import type { ClassroomDetail, ClassroomInput } from "../types";
import CheckInCard from "./CheckInCard.vue";
import ClassroomDialog from "./ClassroomDialog.vue";
import ClassroomList from "./ClassroomList.vue";
import PasskeyPanel from "./PasskeyPanel.vue";
import SessionRoster from "./SessionRoster.vue";

const passkeys = usePasskeys();
const checkIn = useCheckIn();
const classes = useClassrooms();

const tab = ref("kelas");
const dialogOpen = ref(false);
const editing = ref<ClassroomDetail | null>(null);
const deleting = ref(false);

const enabled = computed(() => checkIn.config.value?.biometricsEnabled ?? false);

function newClass() {
  editing.value = null;
  dialogOpen.value = true;
}
async function editClass() {
  if (classes.selectedId.value === null) return;
  const d = await classes.detail(classes.selectedId.value);
  if (d) (editing.value = d), (dialogOpen.value = true);
}
async function submitClass(input: ClassroomInput) {
  if (await classes.save(editing.value?.id ?? null, input)) dialogOpen.value = false;
}
async function confirmDelete() {
  if (classes.selectedId.value !== null) await classes.remove(classes.selectedId.value);
  deleting.value = false;
}
async function register(label: string) {
  await passkeys.register(label);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-muted-foreground text-xs">Presensi per kelas dengan sidik jari, wajah, atau kunci layar perangkat Anda. Pengajar membuka sesi, anggota kelas presensi dari ponselnya.</p>

    <p v-if="checkIn.config.value && !enabled" class="rounded-lg border border-dashed p-3 text-sm" role="status">Presensi biometrik sedang dinonaktifkan oleh admin.</p>
    <p v-if="checkIn.config.value?.locationRequired" class="text-muted-foreground text-xs">Presensi hanya bisa dilakukan di sekitar sekolah. Izinkan akses lokasi saat diminta.</p>

    <section v-if="checkIn.loading.value" aria-busy="true"><Skeleton class="h-20 rounded-xl" /></section>
    <section v-else-if="checkIn.sessions.value.length" class="flex flex-col gap-2" aria-label="Sesi presensi terbuka">
      <CheckInCard
        v-for="s in checkIn.sessions.value"
        :key="s.id"
        :session="s"
        :busy="checkIn.busyId.value === s.id"
        :has-passkey="passkeys.items.value.length > 0"
        :enabled="enabled"
        @check-in="checkIn.checkIn(s)"
        @register="tab = 'perangkat'"
      />
    </section>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="kelas">Kelas</TabsTrigger>
        <TabsTrigger value="perangkat">Perangkat saya</TabsTrigger>
      </TabsList>

      <TabsContent value="kelas" class="mt-4">
        <div class="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ClassroomList
            :items="classes.items.value"
            :selected-id="classes.selectedId.value"
            :loading="classes.loading.value"
            :error="classes.error.value"
            :can-create="classes.canCreate.value"
            @select="classes.selectedId.value = $event"
            @create="newClass"
            @retry="classes.load()"
          />
          <SessionRoster
            v-if="classes.selected.value"
            :key="classes.selected.value.id"
            :classroom="classes.selected.value"
            @edit="editClass"
            @delete="deleting = true"
            @changed="classes.load(true)"
          />
        </div>
      </TabsContent>

      <TabsContent value="perangkat" class="mt-4">
        <PasskeyPanel
          :items="passkeys.items.value"
          :loading="passkeys.loading.value"
          :error="passkeys.error.value"
          :busy="passkeys.busy.value"
          :supported="passkeys.supported"
          :enabled="enabled"
          @register="register"
          @remove="passkeys.remove"
          @retry="passkeys.load"
        />
      </TabsContent>
    </Tabs>

    <ClassroomDialog v-model:open="dialogOpen" :classroom="editing" :submitting="classes.busy.value" @submit="submitClass" />
    <BaseConfirmDialog
      :open="deleting"
      title="Hapus kelas?"
      :description="`Kelas &quot;${classes.selected.value?.name ?? ''}&quot;, semua sesi dan catatan presensinya dihapus permanen.`"
      :submitting="classes.busy.value"
      @update:open="(v: boolean) => (deleting = v)"
      @confirm="confirmDelete"
    />
  </div>
</template>
