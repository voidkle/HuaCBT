import { formatDateTime } from "@/utils/formatDate";
import type { Ts } from "../types";

export const durationLabel = (minutes: number | null) => (minutes ? `${minutes} menit` : "Tanpa batas waktu");

/** "Dibuka 12 Nov 08.00", "Ditutup 12 Nov 10.00", both, or "Kapan saja". */
export function windowLabel(opensAt: Ts | null, closesAt: Ts | null): string {
  if (opensAt && closesAt) return `${formatDateTime(opensAt)} – ${formatDateTime(closesAt)}`;
  if (opensAt) return `Dibuka ${formatDateTime(opensAt)}`;
  if (closesAt) return `Ditutup ${formatDateTime(closesAt)}`;
  return "Kapan saja";
}

/** Whole points when possible ("4"), otherwise up to 2 decimals ("2,5"). */
export const formatScore = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("id-ID", { maximumFractionDigits: 2 }));
