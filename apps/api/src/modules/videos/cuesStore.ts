import { eq } from "drizzle-orm";
import { db } from "../../db";
import { videoCues } from "../../db/schema";
import type { Cue } from "./captions";

/** Replaces a video's whole transcript in one transaction. */
export async function replaceCues(videoId: number, cues: Cue[]) {
  await db.transaction(async (tx) => {
    await tx.delete(videoCues).where(eq(videoCues.videoId, videoId));
    for (let i = 0; i < cues.length; i += 500) {
      await tx.insert(videoCues).values(cues.slice(i, i + 500).map((c, j) => ({ videoId, idx: i + j, startMs: c.startMs, endMs: c.endMs, text: c.text })));
    }
  });
}

export async function readCues(videoId: number): Promise<Cue[]> {
  const rows = await db.select({ startMs: videoCues.startMs, endMs: videoCues.endMs, text: videoCues.text }).from(videoCues).where(eq(videoCues.videoId, videoId)).orderBy(videoCues.idx);
  return rows;
}
