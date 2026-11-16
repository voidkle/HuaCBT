import { Elysia, t } from "elysia";
import { authPlugin } from "../../plugins/auth";
import { getResult, listAvailable, loadAttempt, saveAnswer, startAttempt, submitAttempt } from "./attempts";
import { createExam, deleteExam, getEditorExam, listManaged, replaceQuestions, setPublished, updateExam } from "./exams";
import { buildTemplate, MAX_IMPORT_BYTES, readXlsx } from "./importXlsx";
import { exportCsv, getGradingView, gradeEssay, listAttempts } from "./grading";

// ponytail: no `params`/`query` schemas (Elysia 1.4.32 + Bun frozen objects -> 500 on a real server); ids are parsed by hand
const idOf = (raw: string | undefined) => (raw && /^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null);
const notFound = { message: "Tidak ditemukan" };

const MANAGERS = ["admin", "operator", "teacher"] as const;
const STUDENTS = ["student"] as const;

const nullable = <T extends ReturnType<typeof t.String> | ReturnType<typeof t.Integer>>(s: T) => t.Union([s, t.Null()]);

const settings = t.Object({
  title: t.String({ minLength: 1, maxLength: 150, pattern: "\\S" }),
  description: t.String({ maxLength: 2000 }),
  durationMinutes: nullable(t.Integer({ minimum: 1, maximum: 600 })),
  opensAt: nullable(t.String({ maxLength: 40 })),
  closesAt: nullable(t.String({ maxLength: 40 })),
  maxAttempts: t.Integer({ minimum: 1, maximum: 20 }),
  shuffleQuestions: t.Boolean(),
  shuffleOptions: t.Boolean(),
  showTimer: t.Boolean(),
  accessToken: nullable(t.String({ maxLength: 40 })),
  showScore: t.Boolean(),
  showReview: t.Boolean(),
});

const questions = t.Object({
  questions: t.Array(
    t.Object({
      type: t.Union([t.Literal("single"), t.Literal("multiple"), t.Literal("truefalse"), t.Literal("essay")]),
      text: t.String({ minLength: 1, maxLength: 5000, pattern: "\\S" }),
      explanation: t.String({ maxLength: 2000 }),
      points: t.Integer({ minimum: 1, maximum: 1000 }),
      options: t.Array(t.Object({ text: t.String({ maxLength: 500 }), correct: t.Boolean() }), { maxItems: 8 }),
    }),
    { maxItems: 200 },
  ),
});

type Failure = { ok: false; code: 403 | 404 | 409 | 422; message: string };
const respond = <T>(r: { ok: true; value: T } | Failure, status: (code: Failure["code"], body: { message: string }) => unknown) => (r.ok ? r.value : status(r.code, { message: r.message }));

export const cbtModule = new Elysia({ prefix: "/cbt" })
  .use(authPlugin)

  // ------------------------------------------------------------ managers: exams
  .get("/manage", ({ user }) => listManaged(user), { role: MANAGERS })
  .post("/exams", async ({ user, body, status }) => respond(await createExam(user, body), status), { role: MANAGERS, body: settings })
  .get("/exams/:id", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await getEditorExam(user, id), status) : status(404, notFound);
  }, { role: MANAGERS })
  .patch("/exams/:id", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await updateExam(user, id, body), status) : status(404, notFound);
  }, { role: MANAGERS, body: t.Partial(settings) })
  .delete("/exams/:id", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await deleteExam(user, id), status) : status(404, notFound);
  }, { role: MANAGERS })
  .put("/exams/:id/questions", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await replaceQuestions(user, id, body.questions), status) : status(404, notFound);
  }, { role: MANAGERS, body: questions })
  .post("/exams/:id/publish", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await setPublished(user, id, body.published), status) : status(404, notFound);
  }, { role: MANAGERS, body: t.Object({ published: t.Boolean() }) })

  // ------------------------------------------------------------ managers: Excel import (parse only; the editor saves)
  .get("/import/template", async () => new Response(await buildTemplate(), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": 'attachment; filename="template-soal.xlsx"', "x-content-type-options": "nosniff" } }), { role: MANAGERS })
  .post("/import/preview", async ({ body, status }) => {
    try {
      return await readXlsx(new Uint8Array(await body.file.arrayBuffer()));
    } catch (e) {
      return status(422, { message: e instanceof Error ? e.message : "Berkas tidak bisa dibaca" });
    }
  }, { role: MANAGERS, body: t.Object({ file: t.File({ maxSize: MAX_IMPORT_BYTES }) }) })

  // ------------------------------------------------------------ managers: results and grading
  .get("/exams/:id/attempts", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await listAttempts(user, id), status) : status(404, notFound);
  }, { role: MANAGERS })
  .get("/exams/:id/export", async ({ user, params, status }) => {
    const id = idOf(params.id);
    const r = id ? await exportCsv(user, id) : null;
    if (!r?.ok) return status(r?.code ?? 404, { message: r?.message ?? notFound.message });
    return new Response(r.value.csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${r.value.filename}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }, { role: MANAGERS })
  .get("/attempts/:id/grading", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await getGradingView(user, id), status) : status(404, notFound);
  }, { role: MANAGERS })
  .put("/attempts/:id/grade/:qid", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    const qid = idOf(params.qid);
    return id && qid ? respond(await gradeEssay(user, id, qid, body.score, body.feedback ?? ""), status) : status(404, notFound);
  }, { role: MANAGERS, body: t.Object({ score: t.Number({ minimum: 0, maximum: 1000 }), feedback: t.Optional(t.String({ maxLength: 2000 })) }) })

  // ------------------------------------------------------------ students
  .get("/available", ({ user }) => listAvailable(user), { role: STUDENTS })
  .post("/exams/:id/start", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    return id ? respond(await startAttempt(user, id, body?.token), status) : status(404, notFound);
  }, { role: STUDENTS, body: t.Optional(t.Object({ token: t.Optional(t.String({ maxLength: 60 })) })) })
  .get("/attempts/:id", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await loadAttempt(user, id), status) : status(404, notFound);
  }, { role: STUDENTS })
  .put("/attempts/:id/answers/:qid", async ({ user, params, body, status }) => {
    const id = idOf(params.id);
    const qid = idOf(params.qid);
    return id && qid ? respond(await saveAnswer(user, id, qid, body), status) : status(404, notFound);
  }, { role: STUDENTS, body: t.Object({ selected: t.Optional(t.Array(t.Integer(), { maxItems: 8 })), essayText: t.Optional(t.String({ maxLength: 20000 })), flagged: t.Optional(t.Boolean()) }) })
  .post("/attempts/:id/submit", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await submitAttempt(user, id), status) : status(404, notFound);
  }, { role: STUDENTS })
  .get("/attempts/:id/result", async ({ user, params, status }) => {
    const id = idOf(params.id);
    return id ? respond(await getResult(user, id), status) : status(404, notFound);
  }, { role: STUDENTS });
