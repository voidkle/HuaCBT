import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { onMounted, ref } from "vue";
import { useToast } from "@/composables/useToast";
import * as api from "../services/presenceApi";
import type { Passkey } from "../types";

/** Turns a browser/WebAuthn failure into something a student can act on. */
export function describeWebAuthnError(e: unknown): string {
  const name = (e as { cause?: { name?: string } })?.cause?.name ?? (e as Error)?.name;
  if (name === "NotAllowedError") return "Dibatalkan atau waktu habis. Coba lagi dan selesaikan sidik jari/kunci layar.";
  if (name === "InvalidStateError") return "Perangkat ini sudah terdaftar.";
  if (name === "NotSupportedError") return "Perangkat ini tidak mendukung biometrik/kunci layar.";
  return e instanceof Error ? e.message : "Terjadi kesalahan";
}

export function usePasskeys() {
  const toast = useToast();
  const items = ref<Passkey[]>([]);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const busy = ref(false);
  // false on plain http (except localhost) and on browsers without WebAuthn
  const supported = browserSupportsWebAuthn();

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await api.fetchPasskeys();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Terjadi kesalahan";
    } finally {
      loading.value = false;
    }
  }

  async function register(label: string): Promise<boolean> {
    busy.value = true;
    try {
      const optionsJSON = await api.passkeyOptions();
      await api.savePasskey(label, await startRegistration({ optionsJSON }));
      toast.success("Perangkat terdaftar");
      items.value = await api.fetchPasskeys();
      return true;
    } catch (e) {
      toast.error(describeWebAuthnError(e));
      return false;
    } finally {
      busy.value = false;
    }
  }

  async function remove(id: number): Promise<boolean> {
    busy.value = true;
    try {
      await api.deletePasskey(id);
      items.value = items.value.filter((p) => p.id !== id);
      toast.success("Perangkat dihapus");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Terjadi kesalahan");
      return false;
    } finally {
      busy.value = false;
    }
  }

  onMounted(load);

  return { items, loading, error, busy, supported, load, register, remove };
}
