import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import * as cbtApi from "../services/cbtApi";
import { blankQuestion, retype, validateQuestion } from "../services/validateQuestion";
import type { EditorExam, EditorQuestion, ExamSettings, ImportPreview } from "../types";

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

const toSettings = (e: EditorExam): ExamSettings => ({
  title: e.title,
  description: e.description,
  durationMinutes: e.durationMinutes,
  opensAt: e.opensAt ? new Date(e.opensAt).toISOString() : null,
  closesAt: e.closesAt ? new Date(e.closesAt).toISOString() : null,
  maxAttempts: e.maxAttempts,
  shuffleQuestions: e.shuffleQuestions,
  shuffleOptions: e.shuffleOptions,
  showTimer: e.showTimer,
  accessToken: e.accessToken,
  showScore: e.showScore,
  showReview: e.showReview,
});

const toQuestions = (e: EditorExam): EditorQuestion[] =>
  e.questions.map((q) => ({ key: crypto.randomUUID(), type: q.type, text: q.text, explanation: q.explanation, points: q.points, options: q.options.map((o) => ({ text: o.text, correct: o.correct })) }));

/** Loads an exam for editing and owns the draft (settings + questions), validation, saving and publishing. */
export function useExamEditor(examId: number) {
  const toast = useToast();

  const exam = ref<EditorExam | null>(null);
  const settings = ref<ExamSettings | null>(null);
  const questions = ref<EditorQuestion[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const saving = ref(false);

  // what the server has, to tell whether the draft changed
  let savedSettings = "";
  let savedQuestions = "";
  const snapshot = (qs: EditorQuestion[]) => JSON.stringify(qs.map(({ key: _k, ...q }) => q));

  const locked = computed(() => exam.value?.locked ?? false);
  const published = computed(() => exam.value?.status === "published");
  const questionProblems = computed(() => questions.value.map(validateQuestion));
  const settingsProblem = computed(() => {
    const s = settings.value;
    if (!s) return null;
    if (!s.title.trim()) return "Judul ujian wajib diisi";
    if (s.opensAt && s.closesAt && new Date(s.closesAt) <= new Date(s.opensAt)) return "Waktu tutup harus setelah waktu buka";
    return null;
  });
  const problemCount = computed(() => questionProblems.value.filter(Boolean).length + (settingsProblem.value ? 1 : 0));
  const dirty = computed(() => (settings.value ? JSON.stringify(settings.value) !== savedSettings : false) || (!locked.value && snapshot(questions.value) !== savedQuestions));
  const totalPoints = computed(() => questions.value.reduce((sum, q) => sum + (Number.isFinite(q.points) ? q.points : 0), 0));

  function adopt(e: EditorExam) {
    exam.value = e;
    settings.value = toSettings(e);
    questions.value = toQuestions(e);
    savedSettings = JSON.stringify(settings.value);
    savedQuestions = snapshot(questions.value);
  }

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      adopt(await cbtApi.fetchEditorExam(examId));
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  /** Saves settings, then the questions (unless locked). Returns whether everything was saved. */
  async function save(): Promise<boolean> {
    if (!settings.value || saving.value) return false;
    if (problemCount.value > 0) {
      toast.error("Perbaiki bagian yang ditandai sebelum menyimpan");
      return false;
    }
    saving.value = true;
    try {
      await cbtApi.updateExam(examId, settings.value);
      if (!locked.value && snapshot(questions.value) !== savedQuestions) {
        await cbtApi.saveQuestions(examId, questions.value.map((q) => ({ type: q.type, text: q.text, explanation: q.explanation, points: q.points, options: q.options })));
      }
      adopt(await cbtApi.fetchEditorExam(examId));
      toast.success("Ujian disimpan");
      return true;
    } catch (e) {
      toast.error(message(e));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function togglePublished() {
    if (!exam.value) return;
    if (dirty.value && !(await save())) return;
    try {
      const next = !published.value;
      await cbtApi.setPublished(examId, next);
      adopt(await cbtApi.fetchEditorExam(examId));
      toast.success(next ? "Ujian diterbitkan: siswa sudah bisa melihatnya" : "Ujian ditarik kembali (draf)");
    } catch (e) {
      toast.error(message(e));
    }
  }

  // ---- question list editing
  const addQuestion = () => (questions.value = [...questions.value, blankQuestion()]);
  const removeQuestion = (key: string) => (questions.value = questions.value.filter((q) => q.key !== key));
  const updateQuestion = (next: EditorQuestion) => (questions.value = questions.value.map((q) => (q.key === next.key ? next : q)));
  const changeType = (key: string, type: EditorQuestion["type"]) => (questions.value = questions.value.map((q) => (q.key === key ? retype(q, type) : q)));
  /** Appends questions parsed from an Excel file; they stay a draft until "Simpan". */
  const appendImported = (qs: ImportPreview["questions"]) => (questions.value = [...questions.value, ...qs.map((q) => ({ ...q, key: crypto.randomUUID() }))]);
  function move(key: string, dir: -1 | 1) {
    const list = [...questions.value];
    const i = list.findIndex((q) => q.key === key);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    questions.value = list;
  }
  function duplicate(key: string) {
    const i = questions.value.findIndex((q) => q.key === key);
    if (i === -1) return;
    const source = questions.value[i]!;
    // explicit copy: structuredClone throws on Vue's reactive proxies
    const copy: EditorQuestion = { ...source, key: crypto.randomUUID(), options: source.options.map((o) => ({ ...o })) };
    questions.value = [...questions.value.slice(0, i + 1), copy, ...questions.value.slice(i + 1)];
  }

  onMounted(load);

  return { exam, settings, questions, loading, error, saving, locked, published, dirty, questionProblems, settingsProblem, problemCount, totalPoints, load, save, togglePublished, addQuestion, appendImported, removeQuestion, updateQuestion, changeType, move, duplicate };
}
