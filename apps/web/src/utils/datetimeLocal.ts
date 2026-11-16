const pad = (n: number) => String(n).padStart(2, "0");

/** ISO/Date -> the "yyyy-MM-ddTHH:mm" string a native datetime-local input wants (in the user's time zone). */
export function toDatetimeLocal(value: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fromDatetimeLocal = (value: string): string | null => (value ? new Date(value).toISOString() : null);
