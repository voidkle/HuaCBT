import { type Ref, ref, watch } from "vue";
import { useToast } from "@/composables/useToast";
import * as api from "../services/classesApi";
import type { ClassDetail, LessonInput } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

/** One class: its subject/teacher assignments and weekly timetable, with the edits the school office makes. */
export function useClassDetail(classId: Ref<number>) {
  const toast = useToast();
  const detail = ref<ClassDetail | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);
  let latest = 0;

  async function load(silent = false) {
    const mine = ++latest;
    if (!silent) loading.value = true;
    try {
      const d = await api.fetchClass(classId.value);
      if (mine === latest) (detail.value = d), (error.value = null);
    } catch (e) {
      if (mine === latest && !silent) error.value = message(e);
    } finally {
      if (mine === latest) loading.value = false;
    }
  }

  async function change(action: () => Promise<unknown>, done: string): Promise<boolean> {
    busy.value = true;
    try {
      await action();
      await load(true);
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(message(e)); // clash messages arrive here: "Guru sudah mengajar di kelas lain pada jam tersebut"
      return false;
    } finally {
      busy.value = false;
    }
  }

  const assign = (subjectId: number, teacherId: number | null) => change(() => api.assignSubject(classId.value, subjectId, teacherId), "Guru mata pelajaran disimpan");
  const unassign = (subjectId: number) => change(() => api.unassignSubject(classId.value, subjectId), "Mata pelajaran dilepas dari kelas");
  const addLesson = (subjectId: number, input: LessonInput) => change(() => api.addLesson(classId.value, subjectId, input), "Jam pelajaran ditambahkan");
  const editLesson = (lessonId: number, input: LessonInput) => change(() => api.updateLesson(classId.value, lessonId, input), "Jam pelajaran diperbarui");
  const removeLesson = (lessonId: number) => change(() => api.removeLesson(classId.value, lessonId), "Jam pelajaran dihapus");

  watch(classId, () => void load(), { immediate: true });

  return { detail, loading, error, busy, load, assign, unassign, addLesson, editLesson, removeLesson };
}
