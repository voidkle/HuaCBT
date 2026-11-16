import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import { ApiError } from "@/services/unwrap";
import * as cbtApi from "../services/cbtApi";
import { type Answer, type AttemptView, ESSAY_MAX, type PlayQuestion } from "../types";

type Running = Extract<AttemptView, { status: "in_progress" }>;

const SAVE_CHOICE_MS = 150;
const SAVE_ESSAY_MS = 800;
const RETRY_MS = 3000;
const TICK_MS = 250;

/**
 * The running exam. Three jobs that must never lose the student's work:
 *  1. clock: the deadline comes from the server; the browser only displays it (corrected for clock skew);
 *  2. autosave: every change is queued and retried until the server has it (a refresh or a dropped connection loses nothing);
 *  3. finishing: the exam submits itself at zero, and the server independently refuses answers after the deadline.
 */
export function useExamAttempt(attemptId: number) {
  const router = useRouter();
  const toast = useToast();

  const view = shallowRef<Running | null>(null);
  const answers = reactive<Record<number, Answer>>({});
  const index = ref(0);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
  const submitting = ref(false);

  const goToResult = () => router.replace(`/cbt/attempts/${attemptId}/result`);

  // ---------------------------------------------------------------- clock
  const now = ref(Date.now());
  let skew = 0; // server clock - browser clock, measured at load
  let ticker: ReturnType<typeof setInterval> | undefined;

  const deadline = computed(() => (view.value?.deadlineAt ? new Date(view.value.deadlineAt).getTime() : null));
  const remainingMs = computed(() => (deadline.value === null ? null : Math.max(0, deadline.value - (now.value + skew))));

  // ---------------------------------------------------------------- questions + progress
  const questions = computed<PlayQuestion[]>(() => view.value?.questions ?? []);
  const current = computed(() => questions.value[index.value] ?? null);
  const isAnswered = (q: PlayQuestion) => {
    const a = answers[q.id];
    return !!a && (q.type === "essay" ? a.essayText.trim() !== "" : a.selected.length > 0);
  };
  const answeredCount = computed(() => questions.value.filter(isAnswered).length);
  const flaggedCount = computed(() => questions.value.filter((q) => answers[q.id]?.flagged).length);

  const go = (i: number) => {
    index.value = Math.min(Math.max(0, i), Math.max(0, questions.value.length - 1));
  };
  const next = () => go(index.value + 1);
  const prev = () => go(index.value - 1);

  // ---------------------------------------------------------------- autosave queue
  const dirty = new Set<number>();
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let flushing: Promise<boolean> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  /** 409 = the deadline passed or it was already submitted: the exam is over, go to the result. */
  const isOver = (e: unknown) => e instanceof ApiError && e.status === 409;

  function flush(): Promise<boolean> {
    if (flushing) return flushing.then(() => flush()); // let the running pass finish, then send anything newer
    flushing = (async () => {
      while (dirty.size > 0 && !finished) {
        const qid = dirty.values().next().value as number;
        dirty.delete(qid);
        const a = answers[qid];
        const q = questions.value.find((x) => x.id === qid);
        if (!a || !q) continue;
        saveState.value = "saving";
        // send only what applies to this question type: the API rejects an essay text on a choice question (and vice versa)
        const payload = q.type === "essay" ? { essayText: a.essayText, flagged: a.flagged } : { selected: [...a.selected], flagged: a.flagged };
        try {
          await cbtApi.saveAnswer(attemptId, qid, payload);
        } catch (e) {
          if (isOver(e)) {
            finished = true;
            dirty.clear();
            void goToResult();
            return false;
          }
          dirty.add(qid); // keep it: it is retried until it is saved
          saveState.value = "error";
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => void flush(), RETRY_MS);
          return false;
        }
      }
      if (saveState.value !== "error") saveState.value = "saved";
      return true;
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  function touch(questionId: number, delay: number) {
    dirty.add(questionId);
    clearTimeout(timers.get(questionId));
    timers.set(questionId, setTimeout(() => void flush(), delay));
  }

  function select(q: PlayQuestion, optionId: number, on = true) {
    const a = answers[q.id];
    if (!a || finished) return;
    a.selected = q.type === "multiple" ? (on ? [...new Set([...a.selected, optionId])] : a.selected.filter((id) => id !== optionId)) : [optionId];
    touch(q.id, SAVE_CHOICE_MS);
  }
  function clearChoice(q: PlayQuestion) {
    const a = answers[q.id];
    if (!a || finished) return;
    a.selected = [];
    touch(q.id, SAVE_CHOICE_MS);
  }
  function setEssay(q: PlayQuestion, text: string) {
    const a = answers[q.id];
    if (!a || finished) return;
    a.essayText = text.slice(0, ESSAY_MAX);
    touch(q.id, SAVE_ESSAY_MS);
  }
  function toggleFlag(q: PlayQuestion) {
    const a = answers[q.id];
    if (!a || finished) return;
    a.flagged = !a.flagged;
    touch(q.id, SAVE_CHOICE_MS);
  }

  // ---------------------------------------------------------------- finishing
  /** `auto` = time ran out: submit even if the last autosave could not get through (the server keeps what it has). */
  async function submit(auto = false) {
    if (submitting.value || finished) return;
    submitting.value = true;
    for (const t of timers.values()) clearTimeout(t);
    const saved = await flush();
    if (finished) return; // the flush discovered the exam is over and is navigating
    if (!saved && !auto) {
      submitting.value = false;
      toast.error("Jawabanmu belum tersimpan. Periksa koneksi internet, lalu coba lagi.");
      return;
    }
    try {
      await cbtApi.submitAttempt(attemptId);
      finished = true;
      await goToResult();
    } catch (e) {
      if (isOver(e)) {
        finished = true;
        await goToResult();
        return;
      }
      submitting.value = false;
      toast.error(e instanceof Error ? e.message : "Gagal mengumpulkan");
    }
  }

  // time is up: hand in what we have (the server enforces the same deadline on its own)
  function checkTime() {
    now.value = Date.now();
    if (remainingMs.value === 0 && !submitting.value && !finished) void submit(true);
  }

  // ---------------------------------------------------------------- lifecycle
  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const data = await cbtApi.fetchAttempt(attemptId);
      if (data.status === "submitted") {
        finished = true;
        await goToResult();
        return;
      }
      view.value = data;
      skew = new Date(data.serverNow).getTime() - Date.now();
      for (const q of data.questions) answers[q.id] = { selected: [...(data.answers[q.id]?.selected ?? [])], essayText: data.answers[q.id]?.essayText ?? "", flagged: data.answers[q.id]?.flagged ?? false };
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Ujian tidak dapat dibuka";
    } finally {
      loading.value = false;
    }
  }

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (dirty.size > 0 || flushing) {
      e.preventDefault();
      e.returnValue = ""; // browsers show their own "leave site?" prompt
    }
  };
  const onHidden = () => document.visibilityState === "hidden" && void flush();
  const onOnline = () => void flush();

  onMounted(() => {
    void load();
    ticker = setInterval(checkTime, TICK_MS);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHidden);
  });
  onBeforeUnmount(() => {
    clearInterval(ticker);
    clearTimeout(retryTimer);
    for (const t of timers.values()) clearTimeout(t);
    window.removeEventListener("beforeunload", onBeforeUnload);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onHidden);
    if (!finished) void flush(); // best effort when navigating away inside the app
  });

  return { view, answers, questions, current, index, loading, error, saveState, submitting, remainingMs, answeredCount, flaggedCount, isAnswered, go, next, prev, select, clearChoice, setEssay, toggleFlag, submit, load };
}
