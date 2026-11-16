import { join } from "node:path";
import { uploadDir } from "../../storage";

export const videosDir = join(uploadDir, "videos");
export const partPath = (id: number) => join(videosDir, `${id}.part`);
export const videoPath = (id: number, mime: string | null) => join(videosDir, `${id}.${mime === "video/webm" ? "webm" : "mp4"}`);
export const posterPath = (id: number) => join(videosDir, `${id}.jpg`);
export const tmpDir = (id: number) => join(videosDir, `tmp-${id}`);
