const clock = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" });

/** "14.05" for today, "12 Nov" for older dates (room list). */
export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? clock.format(d) : day.format(d);
}

export const formatClock = (iso: string | Date): string => clock.format(new Date(iso));
