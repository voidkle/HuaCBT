import { onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import * as api from "../services/classesApi";
import type { Room, Subject, Teacher } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

/** Subjects, rooms and (for the school office) the teacher list, plus their create/rename/delete. */
export function useCatalog(withTeachers: boolean) {
  const toast = useToast();
  const subjects = ref<Subject[]>([]);
  const rooms = ref<Room[]>([]);
  const teachers = ref<Teacher[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);

  async function load() {
    try {
      const [s, r, t] = await Promise.all([api.fetchSubjects(), api.fetchRooms(), withTeachers ? api.fetchTeachers() : Promise.resolve([])]);
      [subjects.value, rooms.value, teachers.value] = [s, r, t];
      error.value = null;
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  /** Runs one change, reloads, and reports; true when it worked. */
  async function change(action: () => Promise<unknown>, done: string): Promise<boolean> {
    busy.value = true;
    try {
      await action();
      await load();
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  const addSubject = (name: string) => change(() => api.createSubject(name), "Mata pelajaran ditambahkan");
  const renameSubject = (id: number, name: string) => change(() => api.renameSubject(id, name), "Nama diperbarui");
  const removeSubject = (id: number) => change(() => api.deleteSubject(id), "Mata pelajaran dihapus");
  const addRoom = (name: string, ownerId: number | null) => change(() => api.createRoom(name, ownerId), "Ruang ditambahkan");
  const editRoom = (id: number, name: string, ownerId: number | null) => change(() => api.updateRoom(id, name, ownerId), "Ruang diperbarui");
  const removeRoom = (id: number) => change(() => api.deleteRoom(id), "Ruang dihapus");

  onMounted(load);

  return { subjects, rooms, teachers, loading, error, busy, load, addSubject, renameSubject, removeSubject, addRoom, editRoom, removeRoom };
}
