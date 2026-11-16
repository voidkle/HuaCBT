import { startAuthentication } from "@simplewebauthn/browser";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import * as api from "../services/presenceApi";
import type { MySession, PresenceConfig } from "../types";
import { describeWebAuthnError } from "./usePasskeys";

const POLL_MS = 15_000; // a teacher may open a session while the page is already showing

const position = () =>
  new Promise<api.Where>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Browser ini tidak mendukung lokasi."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error("Lokasi tidak tersedia. Izinkan akses lokasi di browser untuk presensi.")),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });

export function useCheckIn() {
  const toast = useToast();
  const sessions = ref<MySession[]>([]);
  const config = ref<PresenceConfig | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busyId = ref<number | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;

  async function load(silent = false) {
    if (!silent) loading.value = true;
    try {
      [sessions.value, config.value] = await Promise.all([api.fetchMySessions(), api.fetchConfig()]);
      error.value = null;
    } catch (e) {
      if (!silent) error.value = e instanceof Error ? e.message : "Terjadi kesalahan";
    } finally {
      loading.value = false;
    }
  }

  /** GPS (when the school location is set) -> challenge -> the device's fingerprint/face/PIN prompt -> verified on the server. */
  async function checkIn(s: MySession) {
    busyId.value = s.id;
    try {
      const at = config.value?.locationRequired ? await position() : { lat: null, lng: null };
      const optionsJSON = await api.checkInOptions(s.id, at);
      const response = await startAuthentication({ optionsJSON });
      const r = await api.checkIn(s.id, at, response);
      toast.success(r.late ? "Presensi tercatat (terlambat)" : "Presensi tercatat");
    } catch (e) {
      toast.error(describeWebAuthnError(e));
    } finally {
      busyId.value = null;
      await load(true);
    }
  }

  onMounted(() => {
    void load();
    timer = setInterval(() => void load(true), POLL_MS);
  });
  onBeforeUnmount(() => clearInterval(timer));

  return { sessions, config, loading, error, busyId, load, checkIn };
}
