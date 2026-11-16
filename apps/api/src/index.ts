import { Elysia } from "elysia";
import { assignmentsModule } from "./modules/assignments";
import { authModule } from "./modules/auth";
import { ssoConfigProblem } from "./modules/auth/service";
import { cbtModule } from "./modules/cbt";
import { chatModule } from "./modules/chat";
import { classesModule } from "./modules/classes";
import { setRealtimeServer } from "./modules/chat/realtime";
import { recoverJobs } from "./modules/videos/jobs";
import { configModule } from "./modules/config";
import { ebooksModule } from "./modules/ebooks";
import { madingModule } from "./modules/mading";
import { presenceModule } from "./modules/presence";
import { recoverJobs as recoverConversions } from "./modules/presentations/jobs";
import { presentationsModule } from "./modules/presentations";
import { videosModule } from "./modules/videos";
import { corsPlugin } from "./plugins/cors";
import { errorPlugin } from "./plugins/error";
import { SESSION_COOKIE, STATE_COOKIE } from "./plugins/auth";

// ponytail: multipart uploads are buffered in memory and capped here (default 256 MB); stream to disk before allowing bigger files (video)
const MAX_BODY_MB = Number(process.env.MAX_BODY_MB ?? 256);

export const app = new Elysia({ serve: { maxRequestBodySize: MAX_BODY_MB * 1024 * 1024 }, cookie: { secrets: process.env.SESSION_SECRET!, sign: [SESSION_COOKIE, STATE_COOKIE] } })
  .use(corsPlugin)
  .use(errorPlugin)
  .get("/health", () => ({ ok: true }))
  .use(authModule)
  .use(configModule)
  .use(madingModule)
  .use(ebooksModule)
  .use(chatModule)
  .use(cbtModule)
  .use(videosModule)
  .use(presentationsModule)
  .use(presenceModule)
  .use(classesModule)
  .use(assignmentsModule)
  .onStart(({ server }) => {
    setRealtimeServer(server);
    const ssoProblem = ssoConfigProblem();
    if (ssoProblem) console.warn(`WARNING: ${ssoProblem}`);
    void recoverJobs().catch((e) => console.error("video job recovery failed", e)); // re-queue transcript/summary jobs interrupted by a restart
    void recoverConversions().catch((e) => console.error("presentation recovery failed", e)); // re-queue slide conversions interrupted by a restart
  })
  .onStop(() => setRealtimeServer(null));

export type App = typeof app;

if (import.meta.main) app.listen(process.env.PORT ?? 4000, () => console.log(`API on ${process.env.APP_URL}`));
