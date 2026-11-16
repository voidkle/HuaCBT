import { join } from "node:path";
import { uploadDir } from "../../storage";

export const rootDir = join(uploadDir, "presentations");
export const deckDir = (id: number) => join(rootDir, String(id));
export const deckFile = (id: number) => Bun.file(join(deckDir(id), "deck.pdf"));
export const coverFile = (id: number) => Bun.file(join(deckDir(id), "cover.jpg"));
/** One LibreOffice profile for all conversions (they run one at a time); keeps start-up fast and keeps HOME untouched. */
export const profileDir = join(rootDir, ".lo-profile");
