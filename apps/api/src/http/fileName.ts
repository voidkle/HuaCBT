/** Keeps an uploaded file's name readable and safe to put in a header. */
export const cleanName = (raw: string) => (raw.split(/[\\/]/).pop() ?? "berkas").replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 120) || "berkas";
