export const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"] as const;
export const weekdayName = (weekday: number) => WEEKDAYS[weekday - 1] ?? "";

/** 450 -> "07:30" */
export const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** "07:30" -> 450 (NaN when the field is empty) */
export const fromTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? NaN) * 60 + (m ?? NaN);
};

/** Monday = 1 .. Sunday = 7, in the browser's local time. */
export const weekdayOf = (d: Date) => d.getDay() || 7;
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
