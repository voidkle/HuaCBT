const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });

export const formatDate = (iso: string | Date): string => dateFormat.format(new Date(iso));

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatDateTime = (value: string | Date): string => dateTimeFormat.format(new Date(value));
