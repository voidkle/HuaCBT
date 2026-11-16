import { rename } from "node:fs/promises";
import { join } from "node:path";
import { run } from "../videos/media";
import { profileDir } from "./paths";

export const MAX_SLIDES = 1000;
const CONVERT_TIMEOUT_MS = 180_000;

/**
 * PPTX/PPT/ODP -> deck.pdf with headless LibreOffice. The document is untrusted: macros stay off in headless mode, the profile is
 * private, and a timeout kills a runaway conversion.
 * ponytail: soffice may fetch linked external images while converting; in production run the API where outbound traffic is restricted.
 */
export async function convertToPdf(dir: string, sourceName: string): Promise<{ ok: true } | { ok: false; message: string }> {
  let r;
  try {
    r = await run(["soffice", `-env:UserInstallation=file://${profileDir}`, "--headless", "--norestore", "--nolockcheck", "--nodefault", "--nologo", "--convert-to", "pdf", "--outdir", dir, join(dir, sourceName)], CONVERT_TIMEOUT_MS);
  } catch {
    return { ok: false, message: "Server belum memiliki LibreOffice (soffice), jadi presentasi tidak dapat dikonversi." };
  }
  const out = join(dir, sourceName.replace(/\.[^.]+$/, "") + ".pdf");
  // soffice can exit 0 without writing anything (unopenable or password-protected document, or the folder was deleted meanwhile)
  const produced = r.code === 0 && (await Bun.file(out).exists());
  const head = produced ? new Uint8Array(await Bun.file(out).slice(0, 5).arrayBuffer()).join(",") : "";
  if (head !== "37,80,68,70,45") return { ok: false, message: "Presentasi tidak bisa dikonversi (berkas rusak, dilindungi sandi, atau terlalu lama diproses)." };
  await rename(out, join(dir, "deck.pdf"));
  return { ok: true };
}

/** Slide count via poppler's pdfinfo. Null when it cannot be read. */
export async function countPages(pdf: string): Promise<number | null> {
  try {
    const r = await run(["pdfinfo", pdf], 30_000);
    const m = /^Pages:\s+(\d+)/m.exec(r.stdout);
    return r.code === 0 && m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

/** First slide as a JPEG for the library card. Best effort: a deck without a cover still works. */
export async function makeCover(pdf: string, outDir: string): Promise<boolean> {
  try {
    const r = await run(["pdftoppm", "-jpeg", "-f", "1", "-l", "1", "-scale-to", "640", "-singlefile", pdf, join(outDir, "cover")], 60_000);
    return r.code === 0 && (await Bun.file(join(outDir, "cover.jpg")).exists());
  } catch {
    return false;
  }
}
