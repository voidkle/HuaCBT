import { Elysia, ElysiaCustomStatusResponse } from "elysia";
import { SESSION_COOKIE, STATE_COOKIE } from "./auth";

export const errorPlugin = new Elysia({ name: "error" }).onError({ as: "global" }, ({ code, error, set, status }) => {
  // a cookie we can't verify (forged, or SESSION_SECRET rotated): answer 401 and expire it so the next login attempt works
  if (code === "INVALID_COOKIE_SIGNATURE") {
    set.headers["set-cookie"] = [SESSION_COOKIE, STATE_COOKIE].map((c) => `${c}=; Path=/; Max-Age=0`);
    return status(401, { message: "Invalid session" });
  }
  // keep Elysia's default response for validation errors and thrown `status(...)` (e.g. 401/403 from the role macro)
  if (code === "VALIDATION" || code === "PARSE" || error instanceof ElysiaCustomStatusResponse) return;
  if (code === "NOT_FOUND") return status(404, { message: "Not found" });
  console.error(error);
  return status(500, { message: "Internal server error" });
});
