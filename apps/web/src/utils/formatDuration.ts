const pad = (n: number) => String(n).padStart(2, "0");

/** 125 -> "2:05", 3725 -> "1:02:05". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** "90" -> 90, "1:30" -> 90, "01:02:03" -> 3723; anything else -> null. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,5}(:\d{1,2}){0,2}$/.test(t)) return null;
  const parts = t.split(":").map(Number);
  if (parts.slice(1).some((p) => p > 59)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}
