import { sql } from "drizzle-orm";

export type Failure = { ok: false; code: 403 | 404 | 409 | 422; message: string };
export type Result<T> = { ok: true; value: T } | Failure;
export const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export interface Viewer {
  id: number;
  role: "admin" | "operator" | "teacher" | "staff" | "student";
}

/** Admin and operator manage every exam; a teacher only their own. */
export const isAdmin = (v: Viewer) => v.role === "admin" || v.role === "operator";

/** Drizzle prints a column as just "id" in a select without joins, which a subquery would resolve to ITS OWN id: spell it out. */
export const outerExamId = sql.raw('"exams"."id"');
