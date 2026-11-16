import { computed, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import { fetchConfig, removeLogo, updateConfig, uploadLogo } from "../services/configApi";
import { useBrandingStore } from "../stores/useBrandingStore";
import { type AppConfig, type ConfigDraft, type ConfigPatch, LOGO_MAX_BYTES, LOGO_TYPES } from "../types";

const toDraft = (c: AppConfig): ConfigDraft => ({
  siteTitle: c.siteTitle,
  copyrightHolder: c.copyrightHolder,
  maxVideoMb: c.maxVideoMb,
  maxPptMb: c.maxPptMb,
  maxEbookMb: c.maxEbookMb,
  maxChatMediaMb: c.maxChatMediaMb,
  maxAssignmentMb: c.maxAssignmentMb,
  classSystem: c.classSystem,
  movingClass: c.movingClass,
  biometricsEnabled: c.biometricsEnabled,
  schoolLat: c.schoolLat,
  schoolLng: c.schoolLng,
  schoolRadiusM: c.schoolRadiusM,
  aiSummaryEnabled: c.aiSummaryEnabled,
  transcriptionEnabled: c.transcriptionEnabled,
  transcriptionBaseUrl: c.transcriptionBaseUrl,
  transcriptionModel: c.transcriptionModel,
  transcriptionLanguage: c.transcriptionLanguage,
  aiBaseUrl: c.aiBaseUrl,
  aiModel: c.aiModel,
});

const message = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan");

export function useConfigForm() {
  const branding = useBrandingStore();
  const toast = useToast();

  const saved = ref<AppConfig | null>(null);
  const draft = ref<ConfigDraft | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const saving = ref(false);
  const logoBusy = ref(false);

  /** Only the fields that differ from what's stored. */
  const patch = computed<ConfigPatch>(() => {
    if (!saved.value || !draft.value) return {};
    const base = toDraft(saved.value);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base) as (keyof ConfigDraft)[]) {
      if (draft.value[key] !== base[key]) out[key] = draft.value[key];
    }
    if (draft.value.aiApiKey !== undefined) out.aiApiKey = draft.value.aiApiKey;
    if (draft.value.transcriptionApiKey !== undefined) out.transcriptionApiKey = draft.value.transcriptionApiKey;
    return out as ConfigPatch;
  });
  const dirty = computed(() => Object.keys(patch.value).length > 0);

  function accept(config: AppConfig) {
    saved.value = config;
    branding.apply(config);
  }

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const config = await fetchConfig();
      saved.value = config;
      draft.value = toDraft(config);
    } catch (e) {
      error.value = message(e);
    } finally {
      loading.value = false;
    }
  }

  async function save() {
    if (!dirty.value) return;
    saving.value = true;
    try {
      const config = await updateConfig(patch.value);
      accept(config);
      draft.value = toDraft(config);
      toast.success("Pengaturan disimpan");
    } catch (e) {
      toast.error(message(e));
    } finally {
      saving.value = false;
    }
  }

  function reset() {
    if (saved.value) draft.value = toDraft(saved.value);
  }

  async function changeLogo(file: File) {
    if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return toast.error("Logo harus PNG, JPG, atau WebP");
    if (file.size > LOGO_MAX_BYTES) return toast.error("Ukuran logo maksimal 1 MB");
    logoBusy.value = true;
    try {
      const config = await uploadLogo(file);
      // only the logo changed server-side: keep unsaved edits in the draft, and keep the sidebar showing stored text
      saved.value = config;
      branding.apply(config);
      toast.success("Logo diperbarui");
    } catch (e) {
      toast.error(message(e));
    } finally {
      logoBusy.value = false;
    }
  }

  async function deleteLogo() {
    logoBusy.value = true;
    try {
      const config = await removeLogo();
      saved.value = config;
      branding.apply(config);
      toast.success("Logo dihapus");
    } catch (e) {
      toast.error(message(e));
    } finally {
      logoBusy.value = false;
    }
  }

  onMounted(load);

  return { saved, draft, loading, error, saving, logoBusy, dirty, load, save, reset, changeLogo, deleteLogo };
}
