import { computed, onBeforeUnmount, type Ref, ref, watch } from "vue";
import { useToast } from "@/composables/useToast";
import * as api from "../services/presenceApi";
import type { SessionDetail, SessionInput, SessionSummary } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");
const POLL_MS = 5000; // the teacher watches check-ins arrive while a session is open

/** Sessions of one class, the selected session and (for managers) its live roster. */
export function useSessionRoster(classroomId: Ref<number | null>, onChanged: () => void) {
  const toast = useToast();
  const sessions = ref<SessionSummary[]>([]);
  const selectedId = ref<number | null>(null);
  const detail = ref<SessionDetail | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const busy = ref(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  let epoch = 0; // ignore answers that arrive after the class or session changed

  const selected = computed(() => sessions.value.find((s) => s.id === selectedId.value) ?? null);

  async function loadDetail() {
    const id = selectedId.value;
    if (id === null) return void (detail.value = null);
    const mine = epoch;
    try {
      const d = await api.fetchSession(id);
      if (mine === epoch && id === selectedId.value) detail.value = d;
    } catch {
      /* keep the last roster; the next poll retries */
    }
  }

  async function load(silent = false) {
    const cid = classroomId.value;
    if (cid === null) {
      sessions.value = [];
      selectedId.value = null;
      detail.value = null;
      return;
    }
    const mine = epoch;
    if (!silent) loading.value = true;
    try {
      const list = await api.fetchSessions(cid);
      if (mine !== epoch) return;
      sessions.value = list;
      error.value = null;
      if (selectedId.value === null || !list.some((s) => s.id === selectedId.value)) selectedId.value = (list.find((s) => s.open) ?? list[0])?.id ?? null;
      await loadDetail();
    } catch (e) {
      if (!silent && mine === epoch) error.value = message(e);
    } finally {
      if (mine === epoch) loading.value = false;
    }
  }

  async function select(id: number) {
    selectedId.value = id;
    detail.value = null;
    epoch++;
    await loadDetail();
  }

  async function act(run: () => Promise<unknown>, done: string): Promise<boolean> {
    busy.value = true;
    try {
      await run();
      toast.success(done);
      await load(true);
      onChanged();
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  const open = (input: SessionInput) => act(async () => (selectedId.value = (await api.openSession(classroomId.value!, input)).id), "Sesi dibuka");
  const close = (id: number) => act(() => api.closeSession(id), "Sesi ditutup");
  const remove = (id: number) => act(() => api.deleteSession(id), "Sesi dihapus");

  watch(
    classroomId,
    () => {
      epoch++;
      selectedId.value = null;
      detail.value = null;
      void load();
    },
    { immediate: true },
  );

  // poll while the open session might still change (roster fills up, time runs out)
  timer = setInterval(() => {
    if (classroomId.value !== null && !busy.value && (selected.value?.open ?? false)) void load(true);
  }, POLL_MS);
  onBeforeUnmount(() => clearInterval(timer));

  return { sessions, selected, selectedId, detail, loading, error, busy, load, select, open, close, remove };
}
