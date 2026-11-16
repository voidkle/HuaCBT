/** One timed line of a transcript. */
export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

const MAX_CUES = 20000;
const MAX_TEXT = 1000;

/** "00:01:02,500" / "01:02.500" / "1:02" -> milliseconds, or null. */
function parseTime(raw: string): number | null {
  const m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(raw.trim());
  if (!m) return null;
  const [, h = "0", min, sec, frac = "0"] = m;
  return ((Number(h) * 60 + Number(min)) * 60 + Number(sec)) * 1000 + Number(frac.padEnd(3, "0"));
}

const cleanText = (lines: string[]) =>
  lines
    .join(" ")
    .replace(/<[^>]*>/g, "") // <c.colorE5E5E5>, <i>, <00:00:01.000> karaoke tags
    .replace(/\{\\[^}]*\}/g, "") // SRT/ASS style overrides like {\an8}
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);

/**
 * Parses WebVTT or SRT (auto-detected) into cues. Lenient about cue ids, NOTE/STYLE blocks, hours being optional and
 * "," or "." as the decimal mark. Returns an error message for input that yields no cues.
 */
export function parseCaptions(input: string): { ok: true; cues: Cue[] } | { ok: false; message: string } {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at === -1) continue; // header, NOTE, STYLE, cue ids without timing...
    const [a, b] = lines[at]!.split("-->");
    const start = parseTime(a ?? "");
    const end = parseTime((b ?? "").trim().split(/\s+/)[0] ?? ""); // drop cue settings: "align:start position:0%"
    if (start === null || end === null || end <= start) continue;
    const body = cleanText(lines.slice(at + 1));
    if (!body) continue;
    cues.push({ startMs: start, endMs: end, text: body });
    if (cues.length > MAX_CUES) return { ok: false, message: "Terlalu banyak baris teks" };
  }
  if (cues.length === 0) return { ok: false, message: "Tidak ada teks bertanda waktu yang bisa dibaca. Pastikan berkasnya berformat WebVTT (.vtt) atau SRT (.srt)." };
  cues.sort((x, y) => x.startMs - y.startMs);
  return { ok: true, cues };
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const vttTime = (ms: number) => `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}.${pad(ms % 1000, 3)}`;

/** WebVTT for a <track>. Escapes the characters that would be read as markup. */
export function toVtt(cues: Cue[]): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${vttTime(c.startMs)} --> ${vttTime(c.endMs)}\n${esc(c.text)}`).join("\n\n")}\n`;
}

/** Compact "[mm:ss] text" lines for the summary prompt. */
export function toPromptLines(cues: Cue[]): string {
  const stamp = (ms: number) => `${pad(Math.floor(ms / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}`;
  return cues.map((c) => `[${stamp(c.startMs)}] ${c.text}`).join("\n");
}
