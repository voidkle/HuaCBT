<script setup lang="ts">
import { computed, ref } from "vue";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { useCatalog } from "../composables/useCatalog";
import { useClassDirectory } from "../composables/useClassDirectory";
import { useClassMode } from "../composables/useClassMode";
import type { ClassInput } from "../types";
import ClassDetail from "./ClassDetail.vue";
import ClassFormDialog from "./ClassFormDialog.vue";
import ClassList from "./ClassList.vue";
import MySchedule from "./MySchedule.vue";
import RoomsPanel from "./RoomsPanel.vue";
import SubjectsPanel from "./SubjectsPanel.vue";

const auth = useAuthStore();
const classes = useClassDirectory();
const catalog = useCatalog(classes.canManage.value);
const mode = useClassMode();

const hasOwnSchedule = computed(() => auth.hasRole("teacher", "student"));
const tab = ref(hasOwnSchedule.value ? "jadwal" : "kelas");
const dialogOpen = ref(false);
const creating = ref(false);

function newClass() {
  creating.value = true;
  dialogOpen.value = true;
}
function editClass() {
  creating.value = false;
  dialogOpen.value = true;
}
async function submitClass(input: ClassInput) {
  if (await classes.save(creating.value ? null : classes.selectedId.value, input)) dialogOpen.value = false;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-muted-foreground text-xs">Kelas dengan guru kelas (SD) atau guru mata pelajaran dan wali kelas (SMP/SMA/SMK), jadwal mingguan, dan ruang untuk sistem moving class.</p>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger v-if="hasOwnSchedule" value="jadwal">Jadwal saya</TabsTrigger>
        <TabsTrigger value="kelas">Kelas</TabsTrigger>
        <TabsTrigger v-if="classes.canManage.value" value="katalog">{{ mode.moving.value ? "Mapel & ruang" : "Mata pelajaran" }}</TabsTrigger>
      </TabsList>

      <TabsContent v-if="hasOwnSchedule" value="jadwal" class="mt-4"><MySchedule /></TabsContent>

      <TabsContent value="kelas" class="mt-4">
        <div class="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ClassList
            :items="classes.items.value"
            :selected-id="classes.selectedId.value"
            :loading="classes.loading.value"
            :error="classes.error.value"
            :can-create="classes.canManage.value"
            @select="classes.selectedId.value = $event"
            @create="newClass"
            @retry="classes.load()"
          />
          <ClassDetail
            v-if="classes.selected.value"
            :key="classes.selected.value.id"
            :summary="classes.selected.value"
            :can-manage="classes.canManage.value"
            :subjects="catalog.subjects.value"
            :rooms="catalog.rooms.value"
            :teachers="catalog.teachers.value"
            :moving="mode.moving.value"
            @edit="editClass"
          >
            <template #extra="{ classroomId }"><slot name="class-extra" :classroom-id="classroomId" /></template>
          </ClassDetail>
        </div>
      </TabsContent>

      <TabsContent v-if="classes.canManage.value" value="katalog" class="mt-4">
        <div class="grid gap-6 lg:grid-cols-2">
          <SubjectsPanel :items="catalog.subjects.value" :busy="catalog.busy.value" @add="catalog.addSubject" @rename="catalog.renameSubject" @remove="catalog.removeSubject" />
          <RoomsPanel v-if="mode.moving.value" :items="catalog.rooms.value" :teachers="catalog.teachers.value" :busy="catalog.busy.value" @add="catalog.addRoom" @edit="catalog.editRoom" @remove="catalog.removeRoom" />
        </div>
      </TabsContent>
    </Tabs>

    <ClassFormDialog v-model:open="dialogOpen" :classroom="creating ? null : classes.selected.value" :teachers="catalog.teachers.value" :system="mode.system.value" :submitting="classes.busy.value" @submit="submitClass" />
  </div>
</template>
