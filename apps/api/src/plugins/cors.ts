import { cors } from "@elysia/cors";

// Range + exposed headers let pdf.js load e-books page by page across origins (web :5173 -> api :4000 in dev)
export const corsPlugin = cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  exposeHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
});
