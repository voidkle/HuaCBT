// No-DB smoke test of the session plumbing (the full TekSso round trip needs a running TekSso).
import { expect, test } from "bun:test";
import { app } from "./index";

test("login without TekSso credentials says what is missing instead of redirecting to a broken URL", async () => {
  const saved = { id: process.env.TEKSSO_CLIENT_ID, secret: process.env.TEKSSO_CLIENT_SECRET };
  process.env.TEKSSO_CLIENT_ID = "";
  try {
    const res = await app.handle(new Request("http://localhost/auth/login"));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { message: string }).message).toContain("TEKSSO_CLIENT_ID");
    expect(res.headers.get("set-cookie") ?? "").not.toContain("hua_sso_state");
    expect((await app.handle(new Request("http://localhost/auth/logout"))).headers.get("location")).not.toContain("/oauth/logout"); // nothing to end
  } finally {
    process.env.TEKSSO_CLIENT_ID = saved.id;
    process.env.TEKSSO_CLIENT_SECRET = saved.secret;
  }
});

test("login redirects to TekSso with a signed state cookie; /auth/me needs a session", async () => {
  process.env.TEKSSO_CLIENT_ID ||= "test-client"; // the redirect shape is what is tested, not real credentials
  process.env.TEKSSO_CLIENT_SECRET ||= "test-secret";
  const login = await app.handle(new Request("http://localhost/auth/login?return_to=/x"));
  expect(login.status).toBe(302);
  expect(login.headers.get("location")).toContain("/oauth/authorize?");
  expect(login.headers.get("set-cookie")).toContain("hua_sso_state=");

  expect((await app.handle(new Request("http://localhost/auth/me"))).status).toBe(401);

  // a tampered (unsigned) session cookie must not authenticate
  const forged = await app.handle(new Request("http://localhost/auth/me", { headers: { cookie: 'hua_session={"id":1}' } }));
  expect(forged.status).toBe(401);
  expect(forged.headers.get("set-cookie")).toContain("Max-Age=0");
  // the 401 clears the stale cookie, so the next attempt works (browser retries after /auth/me 401)
  const relogin = await app.handle(new Request("http://localhost/auth/login", { headers: { cookie: "hua_session=bogus" } }));
  expect(relogin.status).toBe(401);
});

test("config management endpoints require a session", async () => {
  // well-formed bodies on purpose: Elysia validates the body before the role check runs
  const form = new FormData();
  form.append("file", new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" }));
  const calls: [string, string, string | FormData | undefined, Record<string, string>][] = [
    ["GET", "/config", undefined, {}],
    ["PATCH", "/config", "{}", { "content-type": "application/json" }],
    ["POST", "/config/logo", form, {}],
    ["DELETE", "/config/logo", undefined, {}],
  ];
  for (const [method, path, body, headers] of calls) {
    const res = await app.handle(new Request(`http://localhost${path}`, { method, body, headers }));
    expect({ path, status: res.status }).toEqual({ path, status: 401 });
  }
});

test("mading endpoints require a session", async () => {
  const json = { "content-type": "application/json" };
  const notice = JSON.stringify({ title: "t", body: "b" });
  const calls: [string, string, string | undefined, Record<string, string>][] = [
    ["GET", "/mading", undefined, {}],
    ["POST", "/mading", notice, json],
    ["PATCH", "/mading/1", notice, json],
    ["DELETE", "/mading/1", undefined, {}],
    ["POST", "/mading/1/approve", undefined, {}],
    ["POST", "/mading/1/reject", "{}", json],
  ];
  for (const [method, path, body, headers] of calls) {
    const res = await app.handle(new Request(`http://localhost${path}`, { method, body, headers }));
    expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
  }
});

// app.handle() skips Bun's real request path (frozen route params etc.), so also go through a listening server
test("param routes work through a real server (401 for anonymous, not 500)", async () => {
  const server = app.listen(0);
  try {
    const base = `http://localhost:${server.server!.port}`;
    for (const [method, path] of [["POST", "/mading/1/approve"], ["DELETE", "/mading/1"], ["POST", "/mading/1/reject"]] as const) {
      const res = await fetch(base + path, { method });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  } finally {
    await server.stop();
  }
});

test("ebook endpoints require a session (real server)", async () => {
  const server = app.listen(0);
  try {
    const base = `http://localhost:${server.server!.port}`;
    const form = new FormData();
    form.append("file", new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" }));
    form.append("title", "t");
    form.append("pageCount", "1");
    const calls: [string, string, string | FormData | undefined, Record<string, string>][] = [
      ["GET", "/ebooks", undefined, {}],
      ["POST", "/ebooks", form, {}],
      ["GET", "/ebooks/1", undefined, {}],
      ["GET", "/ebooks/1/file", undefined, { range: "bytes=0-9" }],
      ["GET", "/ebooks/1/cover", undefined, {}],
      ["PUT", "/ebooks/1/progress", '{"page":1}', { "content-type": "application/json" }],
      ["DELETE", "/ebooks/1", undefined, {}],
    ];
    for (const [method, path, body, headers] of calls) {
      const res = await fetch(base + path, { method, body, headers });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  } finally {
    await server.stop();
  }
});

test("chat endpoints and the WebSocket require a session (real server)", async () => {
  const server = app.listen(0);
  try {
    const port = server.server!.port;
    const form = new FormData();
    form.append("text", "hi");
    const calls: [string, string, string | FormData | undefined, Record<string, string>][] = [
      ["GET", "/chat/rooms", undefined, {}],
      ["POST", "/chat/rooms", '{"type":"direct","userId":1}', { "content-type": "application/json" }],
      ["GET", "/chat/rooms/1/messages", undefined, {}],
      ["POST", "/chat/rooms/1/messages", form, {}],
      ["POST", "/chat/rooms/1/read", undefined, {}],
      ["DELETE", "/chat/messages/1", undefined, {}],
      ["GET", "/chat/messages/1/file", undefined, { range: "bytes=0-9" }],
      ["GET", "/chat/users?q=a", undefined, {}],
      ["GET", "/chat/linkables", undefined, {}],
    ];
    for (const [method, path, body, headers] of calls) {
      const res = await fetch(`http://localhost:${port}${path}`, { method, body, headers });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
    // an anonymous WebSocket must never open
    const opened = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}/chat/ws`);
      ws.onopen = () => (ws.close(), resolve(true));
      ws.onerror = ws.onclose = () => resolve(false);
    });
    expect(opened).toBe(false);
  } finally {
    await server.stop();
  }
});

test("CBT endpoints require the right session (real server)", async () => {
  const server = app.listen(0);
  try {
    const base = `http://localhost:${server.server!.port}`;
    const json = { "content-type": "application/json" };
    // well-formed bodies on purpose: Elysia validates the body before the role check runs
    const exam = JSON.stringify({ title: "t", description: "", durationMinutes: null, opensAt: null, closesAt: null, maxAttempts: 1, shuffleQuestions: false, shuffleOptions: false, showTimer: true, accessToken: null, showScore: true, showReview: false });
    const calls: [string, string, string | undefined, Record<string, string>][] = [
      ["GET", "/cbt/manage", undefined, {}],
      ["POST", "/cbt/exams", exam, json],
      ["GET", "/cbt/exams/1", undefined, {}],
      ["PUT", "/cbt/exams/1/questions", '{"questions":[]}', json],
      ["GET", "/cbt/exams/1/attempts", undefined, {}],
      ["GET", "/cbt/exams/1/export", undefined, {}],
      ["GET", "/cbt/attempts/1/grading", undefined, {}],
      ["PUT", "/cbt/attempts/1/grade/1", '{"score":1}', json],
      ["GET", "/cbt/available", undefined, {}],
      ["POST", "/cbt/exams/1/start", undefined, {}],
      ["GET", "/cbt/attempts/1", undefined, {}],
      ["PUT", "/cbt/attempts/1/answers/1", '{"flagged":true}', json],
      ["POST", "/cbt/attempts/1/submit", undefined, {}],
      ["GET", "/cbt/attempts/1/result", undefined, {}],
    ];
    for (const [method, path, body, headers] of calls) {
      const res = await fetch(base + path, { method, body, headers });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  } finally {
    await server.stop();
  }
});

test("video endpoints require a session (real server)", async () => {
  const server = app.listen(0);
  try {
    const base = `http://localhost:${server.server!.port}`;
    const json = { "content-type": "application/json" };
    const fd = () => { const f = new FormData(); f.set("file", new File(["x"], "a.xlsx")); return f; };
    const calls: [string, string, string | FormData | undefined, Record<string, string>][] = [
      ["GET", "/videos", undefined, {}],
      ["POST", "/videos", '{"title":"t","description":"","filename":"a.mp4","sizeBytes":10}', json],
      ["GET", "/videos/1", undefined, {}],
      ["PATCH", "/videos/1", '{"title":"t","description":""}', json],
      ["DELETE", "/videos/1", undefined, {}],
      ["GET", "/videos/1/upload", undefined, {}],
      ["PATCH", "/videos/1/upload?offset=0", "abc", { "content-type": "application/octet-stream" }],
      ["POST", "/videos/1/complete", undefined, {}],
      ["POST", "/videos/1/approve", undefined, {}],
      ["POST", "/videos/1/reject", "{}", json],
      ["PUT", "/videos/1/progress", '{"position":1}', json],
      ["GET", "/videos/1/file", undefined, { range: "bytes=0-9" }],
      ["GET", "/videos/1/poster", undefined, {}],
      ["GET", "/videos/1/captions.vtt", undefined, {}],
      ["GET", "/videos/1/transcript", undefined, {}],
      ["POST", "/videos/1/transcript", undefined, {}],
      ["PUT", "/videos/1/captions", '{"content":"x"}', json],
      ["DELETE", "/videos/1/transcript", undefined, {}],
      ["POST", "/videos/1/summary", undefined, {}],
      ["GET", "/cbt/import/template", undefined, {}],
      ["POST", "/cbt/import/preview", fd(), {}],
      ["GET", "/presentations", undefined, {}],
      ["POST", "/presentations", (() => { const f = new FormData(); f.set("title", "t"); f.set("link", "https://docs.google.com/presentation/d/1AbCdEfGhIjKl/edit"); return f; })(), {}],
      ["GET", "/presentations/1", undefined, {}],
      ["GET", "/presentations/1/file", undefined, { range: "bytes=0-9" }],
      ["GET", "/presentations/1/cover", undefined, {}],
      ["PUT", "/presentations/1/progress", '{"page":1}', json],
      ["DELETE", "/presentations/1", undefined, {}],
      ["GET", "/presence/passkeys", undefined, {}],
      ["POST", "/presence/passkeys/options", undefined, {}],
      ["POST", "/presence/passkeys", '{"label":"hp","response":{}}', json],
      ["DELETE", "/presence/passkeys/1", undefined, {}],
      ["GET", "/presence/people", undefined, {}],
      ["GET", "/presence/classrooms", undefined, {}],
      ["POST", "/presence/classrooms", '{"name":"X","memberIds":[]}', json],
      ["GET", "/presence/classrooms/1", undefined, {}],
      ["PATCH", "/presence/classrooms/1", '{"name":"X","memberIds":[]}', json],
      ["DELETE", "/presence/classrooms/1", undefined, {}],
      ["GET", "/presence/classrooms/1/sessions", undefined, {}],
      ["POST", "/presence/classrooms/1/sessions", '{"title":"t"}', json],
      ["GET", "/presence/sessions/open", undefined, {}],
      ["GET", "/presence/sessions/1", undefined, {}],
      ["POST", "/presence/sessions/1/close", undefined, {}],
      ["DELETE", "/presence/sessions/1", undefined, {}],
      ["POST", "/presence/sessions/1/check-in/options", "{}", json],
      ["POST", "/presence/sessions/1/check-in", '{"response":{}}', json],
      ["GET", "/classes", undefined, {}],
      ["POST", "/classes", '{"name":"X"}', json],
      ["GET", "/classes/1", undefined, {}],
      ["PATCH", "/classes/1", '{"name":"X"}', json],
      ["GET", "/classes/teachers", undefined, {}],
      ["GET", "/classes/subjects", undefined, {}],
      ["POST", "/classes/subjects", '{"name":"Matematika"}', json],
      ["PATCH", "/classes/subjects/1", '{"name":"Matematika"}', json],
      ["DELETE", "/classes/subjects/1", undefined, {}],
      ["GET", "/classes/rooms", undefined, {}],
      ["POST", "/classes/rooms", '{"name":"Lab"}', json],
      ["PATCH", "/classes/rooms/1", '{"name":"Lab"}', json],
      ["DELETE", "/classes/rooms/1", undefined, {}],
      ["GET", "/classes/schedule/mine", undefined, {}],
      ["PUT", "/classes/1/subjects/1", '{"teacherId":1}', json],
      ["DELETE", "/classes/1/subjects/1", undefined, {}],
      ["POST", "/classes/1/subjects/1/lessons", '{"weekday":1,"startMin":420,"endMin":465}', json],
      ["PATCH", "/classes/1/lessons/1", '{"weekday":1,"startMin":420,"endMin":465}', json],
      ["DELETE", "/classes/1/lessons/1", undefined, {}],
      ["GET", "/assignments", undefined, {}],
      ["GET", "/assignments/targets", undefined, {}],
      ["POST", "/assignments", '{"classroomId":1,"subjectId":1,"title":"PR","dueAt":"2030-01-01T00:00:00Z"}', json],
      ["GET", "/assignments/1", undefined, {}],
      ["PATCH", "/assignments/1", '{"title":"PR","dueAt":"2030-01-01T00:00:00Z"}', json],
      ["DELETE", "/assignments/1", undefined, {}],
      ["POST", "/assignments/1/files", (() => { const f = new FormData(); f.set("files", new File(["x"], "a.txt")); return f; })(), {}],
      ["DELETE", "/assignments/1/files/1", undefined, {}],
      ["GET", "/assignments/files/1", undefined, {}],
      ["GET", "/assignments/1/submissions", undefined, {}],
      ["PUT", "/assignments/1/submission", (() => { const f = new FormData(); f.set("text", "jawaban"); return f; })(), {}],
      ["GET", "/assignments/submissions/1", undefined, {}],
      ["PUT", "/assignments/submissions/1/grade", '{"score":80}', json],
      ["DELETE", "/assignments/submissions/1/grade", undefined, {}],
    ];
    for (const [method, path, body, headers] of calls) {
      const res = await fetch(base + path, { method, body, headers });
      expect({ method, path, status: res.status }).toEqual({ method, path, status: 401 });
    }
  } finally {
    await server.stop();
  }
});
