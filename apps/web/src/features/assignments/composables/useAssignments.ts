import { computed, onMounted, type Ref, ref, watch } from "vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import * as api from "../services/assignmentsApi";
import type { Assignment, NewAssignment, Target } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

/** The viewer's assignments (a student's, or the ones a teacher posted), optionally for one class. */
export function useAssignments(classroomId?: Ref<number | undefined>) {
  const auth = useAuthStore();
  const toast = useToast();
  const items = ref<Assignment[]>([]);
  const targets = ref<Target[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);

  const canPost = computed(() => auth.hasRole("admin", "operator", "teacher"));
  /** Not yet due, first the soonest; and past due, newest first. */
  const upcoming = computed(() => items.value.filter((a) => a.dueAt >= new Date()).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()));
  const past = computed(() => items.value.filter((a) => a.dueAt < new Date()).sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime()));

  async function load() {
    loading.value = true;
    try {
      items.value = await api.fetchAssignments(classroomId?.value);
      error.value = null;
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  async function loadTargets() {
    try {
      targets.value = await api.fetchTargets();
    } catch (e) {
      toast.error(message(e));
    }
  }

  /** Creates the assignment, then attaches its files. Returns the new id (also when only the files failed). */
  async function create(input: NewAssignment, files: File[]): Promise<number | null> {
    busy.value = true;
    try {
      const { id } = await api.createAssignment(input);
      if (files.length) await api.addFiles(id, files).catch((e) => toast.error(`Tugas dibuat, tetapi lampiran gagal: ${message(e)}`));
      await load();
      toast.success("Tugas diposting");
      return id;
    } catch (e) {
      toast.error(message(e));
      return null;
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);
  if (classroomId) watch(classroomId, load);

  return { items, upcoming, past, targets, loading, error, busy, canPost, load, loadTargets, create };
}
