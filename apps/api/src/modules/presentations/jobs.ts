import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { presentations } from "../../db/schema";
import { convertToPdf, countPages, makeCover, MAX_SLIDES } from "./convert";
import { deckDir, profileDir } from "./paths";

// One conversion at a time: they share a LibreOffice profile, and a deck can use a lot of memory.
const queue: number[] = [];
let draining: Promise<void> | null = null;

export function enqueueConversion(id: number) {
  queue.push(id);
  draining ??= drain().finally(() => (draining = null));
}

/** Resolves when nothing is queued or running (tests). */
export const idle = async () => {
  while (draining) await draining;
};

async function drain() {
  while (queue.length) {
    const id = queue.shift()!;
    try {
      await convertOne(id);
    } catch (e) {
      console.error("presentation conversion crashed", id, e);
      await fail(id, "Konversi gagal karena kesalahan di server.");
    }
  }
}

const fail = async (id: number, reason: string) => {
  await db.update(presentations).set({ status: "failed", failureReason: reason }).where(eq(presentations.id, id));
  await removeSource(id);
};

async function removeSource(id: number) {
  const dir = deckDir(id);
  for (const f of await readdir(dir).catch(() => [])) if (f.startsWith("source.")) await rm(join(dir, f), { force: true });
}

async function convertOne(id: number) {
  const [row] = await db.select({ status: presentations.status }).from(presentations).where(eq(presentations.id, id));
  if (row?.status !== "converting") return; // deleted or already done
  const dir = deckDir(id);
  const source = (await readdir(dir).catch(() => [])).find((f) => f.startsWith("source."));
  if (!source) return fail(id, "Berkas sumber tidak ditemukan.");

  await mkdir(profileDir, { recursive: true });
  const converted = await convertToPdf(dir, source);
  if (!converted.ok) return fail(id, converted.message);
  const pdf = join(dir, "deck.pdf");
  const pages = await countPages(pdf);
  if (!pages) return fail(id, "Hasil konversi tidak bisa dibaca (pdfinfo/poppler belum terpasang di server?).");
  if (pages > MAX_SLIDES) return fail(id, `Maksimal ${MAX_SLIDES} slide per presentasi (berkas ini ${pages}).`);
  const hasCover = await makeCover(pdf, dir);
  // the deck may have been deleted while converting: a no-op update, then clean the leftovers
  const done = await db.update(presentations).set({ status: "ready", pageCount: pages, hasCover, failureReason: null }).where(eq(presentations.id, id)).returning({ id: presentations.id });
  if (done.length === 0) await rm(dir, { recursive: true, force: true });
  else await removeSource(id); // the PDF is what viewers get; the original is not kept
}

/** On start-up: conversions a restart interrupted are queued again. */
export async function recoverJobs() {
  const stuck = await db.select({ id: presentations.id }).from(presentations).where(eq(presentations.status, "converting"));
  for (const { id } of stuck) enqueueConversion(id);
}
