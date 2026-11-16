import { join } from "node:path";

/** Root folder for uploaded files (logo, e-books). Needs a persistent volume in production. */
export const uploadDir = process.env.UPLOAD_DIR ?? join(import.meta.dir, "../uploads");
