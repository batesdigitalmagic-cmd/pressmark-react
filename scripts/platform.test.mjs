import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import platform from "../api/platform/[...path].js";
import worker from "../api/render-jobs/worker/[...path].js";
import { __resetLocalKv } from "../lib/render-jobs/kv.js";
import { templateById } from "../lib/platform/templates.js";
import { putOutputPdf } from "../lib/render-jobs/blob.js";
const claim = worker;
const result = worker;

/* A small but structurally valid PDF with the template's trim size. */
function makePdf({ pages = 2, width, height, padBytes = 0 } = {}) {
  const trim = templateById("directory-classic").trimSize;
  const w = Math.round((width ?? trim.width) * 72), h = Math.round((height ?? trim.height) * 72);
  const objs = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(" ")}] /Count ${pages} >>`];
  for (let i = 0; i < pages; i += 1) objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] >>`);
  let out = "%PDF-1.7\n" + "% pressmark test padding line\n".repeat(20) + (padBytes ? `${"%".repeat(78)}\n`.repeat(Math.ceil(padBytes / 80)) : "");
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

/* Drive the real worker endpoints: claim the queued job and upload a PDF as the worker. */
async function workerRenders(pdf) {
  const headers = { authorization: `Bearer ${workerToken}`, "content-type": "application/json" };
  const claimed = await claim(new Request(`${ORIGIN}/api/render-jobs/worker/claim`, { method: "POST", headers, body: JSON.stringify({ workerId: "mac-1" }) }));
  assert.equal(claimed.status, 200);
  const job = await claimed.json();
  const form = new FormData();
  form.set("status", "completed"); form.set("workerId", "mac-1");
  form.set("pdf", new File([pdf], "output.pdf", { type: "application/pdf" }));
  const done = await result(new Request(`${ORIGIN}${job.resultUrl}`, { method: "POST", headers: { authorization: `Bearer ${workerToken}` }, body: form }));
  assert.equal(done.status, 200, await done.clone().text());
  return job;
}

const ORIGIN = "https://pressmark.test";
const CSV =
  "last_name,first_name,address,phone,email\nSmith,Amy,1 Oak St,555-0101,amy@x.test\nJones,Bo,2 Elm St,555-0102,bo@x.test\n";
const workerToken = "test-worker-token-with-enough-entropy";
let root;

test.before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "pressmark-platform-test-"));
  process.env.NODE_ENV = "test";
  process.env.PRESSMARK_RENDER_LOCAL_DIR = root;
  process.env.PRESSMARK_WORKER_TOKEN = workerToken;
  process.env.PLATFORM_SESSION_SECRET = "s".repeat(40);
});
test.after(async () => rm(root, { recursive: true, force: true }));
test.beforeEach(() => __resetLocalKv());

async function call(method, route, { body, cookie, form, origin = ORIGIN } = {}) {
  const headers = { origin, host: "pressmark.test" };
  if (cookie) headers.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  const response = await platform(new Request(`${ORIGIN}/api/platform/${route}`, { method, headers, body: payload }));
  const type = response.headers.get("content-type") || "";
  return {
    status: response.status,
    json: type.includes("json") ? await response.json() : null,
    bytes: type.includes("pdf") ? new Uint8Array(await response.arrayBuffer()) : null,
    cookie: (response.headers.get("set-cookie") || "").split(";")[0],
  };
}

async function signUp(email, company = "Acme Print", verify = true) {
  const r = await call("POST", "register", { body: { email, password: "correct horse battery", companyName: company, name: "Pat" } });
  assert.equal(r.status, 201);
  if (verify) assert.equal((await call("POST", "verify-email", { body: { token: r.json.devVerificationToken } })).status, 200);
  return r.cookie;
}

const csvForm = (text = CSV, name = "people.csv") => {
  const form = new FormData();
  form.set("csv", new File([text], name, { type: "text/csv" }));
  return form;
};

async function newProject(cookie, name = "Spring Directory") {
  const r = await call("POST", "projects", { cookie, body: { name, templateId: "directory-classic" } });
  assert.equal(r.status, 201);
  return r.json.project;
}

test("registration, login, session and logout", async () => {
  const cookie = await signUp("owner@acme.test");
  const me = await call("GET", "me", { cookie });
  assert.equal(me.json.user.emailVerified, true);
  assert.equal(me.json.org.name, "Acme Print");
  assert.equal(me.json.role, "owner");
  assert.equal(JSON.stringify(me.json).includes("passwordHash"), false);

  assert.equal((await call("GET", "me")).status, 401);
  assert.equal((await call("POST", "login", { body: { email: "owner@acme.test", password: "wrong password!!" } })).status, 401);
  assert.equal((await call("POST", "login", { body: { email: "nobody@acme.test", password: "wrong password!!" } })).status, 401);
  const login = await call("POST", "login", { body: { email: "OWNER@acme.test", password: "correct horse battery" } });
  assert.equal(login.status, 200);
  assert.equal((await call("GET", "me", { cookie: login.cookie })).status, 200);
});

test("registration validates input and does not reveal existing emails", async () => {
  assert.equal((await call("POST", "register", { body: { email: "nope", password: "correct horse battery", companyName: "X" } })).status, 400);
  assert.equal((await call("POST", "register", { body: { email: "a@b.test", password: "short", companyName: "X" } })).status, 400);
  assert.equal((await call("POST", "register", { body: { email: "a@b.test", password: "correct horse battery", companyName: "" } })).status, 400);
  await signUp("dup@acme.test");
  const again = await call("POST", "register", { body: { email: "dup@acme.test", password: "another long pass", companyName: "Evil" } });
  assert.equal(again.status, 202);
  assert.equal(again.cookie, "");
});

test("password reset is single-use and revokes existing sessions", async () => {
  const cookie = await signUp("reset@acme.test");
  const req = await call("POST", "request-reset", { body: { email: "reset@acme.test" } });
  const token = req.json.devResetToken;
  assert.ok(token);
  assert.equal((await call("POST", "reset-password", { body: { token, password: "brand new password" } })).status, 200);
  assert.equal((await call("POST", "reset-password", { body: { token, password: "brand new password" } })).status, 400);
  assert.equal((await call("GET", "me", { cookie })).status, 401, "old session revoked");
  assert.equal((await call("POST", "login", { body: { email: "reset@acme.test", password: "brand new password" } })).status, 200);
  const unknown = await call("POST", "request-reset", { body: { email: "ghost@acme.test" } });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.json.devResetToken, undefined);
});

test("a tampered or foreign-secret session cookie is rejected", async () => {
  const cookie = await signUp("t@acme.test");
  const [name, value] = cookie.split("=");
  assert.equal((await call("GET", "me", { cookie: `${name}=${value.slice(0, -3)}abc` })).status, 401);
});

test("cross-site writes are refused", async () => {
  const r = await call("POST", "login", { body: { email: "a@b.test", password: "x" }, origin: "https://evil.test" });
  assert.equal(r.status, 403);
});

test("organizations cannot see or touch each other's projects", async () => {
  const a = await signUp("a@one.test", "One");
  const b = await signUp("b@two.test", "Two");
  const project = await newProject(a);
  assert.equal((await call("POST", `projects/${project.id}/csv`, { cookie: a, form: csvForm() })).status, 200);

  assert.equal((await call("GET", "projects", { cookie: b })).json.projects.length, 0);
  for (const [method, route] of [
    ["GET", `projects/${project.id}`], ["PATCH", `projects/${project.id}`], ["POST", `projects/${project.id}/submit`],
    ["POST", `projects/${project.id}/duplicate`], ["POST", `projects/${project.id}/archive`], ["GET", `projects/${project.id}/proofs/1/file`], ["GET", `projects/${project.id}/final`], ["POST", `projects/${project.id}/proofs/1/approve`],
  ]) {
    const r = await call(method, route, { cookie: b, body: method === "GET" ? undefined : {} });
    assert.equal(r.status, 404, `${method} ${route}`);
  }
  assert.equal((await call("POST", `projects/${project.id}/csv`, { cookie: b, form: csvForm() })).status, 404);
  assert.equal((await call("GET", "projects")).status, 401);
});

test("CSV upload validates, previews, and rejects bad data helpfully", async () => {
  const cookie = await signUp("c@acme.test");
  const project = await newProject(cookie);
  const bad = await call("POST", `projects/${project.id}/csv`, { cookie, form: csvForm("name,city\nA,B\n") });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /Missing required headers/);
  assert.equal((await call("POST", `projects/${project.id}/csv`, { cookie, form: csvForm(CSV, "x.txt") })).status, 400);

  const ok = await call("POST", `projects/${project.id}/csv`, { cookie, form: csvForm() });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.project.status, "uploaded");
  assert.equal(ok.json.project.csv.rowCount, 2);
  assert.equal(ok.json.project.preview.rows[0].last_name, "Jones", "sorted by last name");
});

test("submit requires verified email and data, rejects bad brand colours", async () => {
  const cookie = await signUp("u@acme.test", "Unverified", false);
  const project = await newProject(cookie);
  assert.equal((await call("POST", `projects/${project.id}/submit`, { cookie, body: {} })).status, 403);

  const ok = await signUp("v@acme.test", "Verified");
  const p2 = await newProject(ok);
  assert.equal((await call("POST", `projects/${p2.id}/submit`, { cookie: ok, body: {} })).status, 400, "no CSV yet");
  assert.equal((await call("PATCH", `projects/${p2.id}`, { cookie: ok, body: { brandColors: { primaryColor: "javascript:1" } } })).status, 400);
});

test("full lifecycle: submit, waiting-for-worker, worker renders, project completes, download is org-scoped", async () => {
  const a = await signUp("a@life.test", "Life");
  const b = await signUp("b@life.test", "Other");
  const project = await newProject(a);
  await call("PATCH", `projects/${project.id}`, { cookie: a, body: { brandColors: { primaryColor: "#7a1f35" } } });
  await call("POST", `projects/${project.id}/csv`, { cookie: a, form: csvForm() });

  const submit = await call("POST", `projects/${project.id}/submit`, { cookie: a, body: {} });
  assert.equal(submit.status, 202);
  assert.equal(submit.json.project.status, "queued");
  assert.equal(submit.json.project.production.waitingForWorker, true, "no worker has connected");
  assert.deepEqual(submit.json.project.proofs, []);
  assert.equal((await call("POST", `projects/${project.id}/submit`, { cookie: a, body: {} })).status, 409, "no double submit");
  assert.equal((await call("PATCH", `projects/${project.id}`, { cookie: a, body: { name: "x" } })).status, 409, "locked in production");

  const workerHeaders = { authorization: `Bearer ${workerToken}`, "content-type": "application/json" };
  const claimed = await claim(new Request(`${ORIGIN}/api/render-jobs/worker/claim`, { method: "POST", headers: workerHeaders, body: JSON.stringify({ workerId: "mac-1" }) }));
  assert.equal(claimed.status, 200);
  const job = await claimed.json();
  assert.equal(job.brandColors.primaryColor, "#7A1F35", "brand colours reach the worker");

  const mid = await call("GET", `projects/${project.id}`, { cookie: a });
  assert.equal(mid.json.project.status, "processing");
  assert.equal(mid.json.project.production.waitingForWorker, false, "worker is now seen");

  const pdf = makePdf();
  const form = new FormData();
  form.set("status", "completed");
  form.set("workerId", "mac-1");
  form.set("pdf", new File([pdf], "output.pdf", { type: "application/pdf" }));
  const done = await result(new Request(`${ORIGIN}${job.resultUrl}`, {
    method: "POST",
    headers: { authorization: `Bearer ${workerToken}` },
    body: form,
  }));
  assert.equal(done.status, 200, await done.clone().text());

  const finished = await call("GET", `projects/${project.id}`, { cookie: a });
  assert.equal(finished.json.project.status, "proof_ready");
  assert.equal(finished.json.project.proofs.length, 1);
  assert.equal(finished.json.project.proofs[0].decision, "pending");
  assert.equal(finished.json.project.finalFile, null, "nothing is final before approval");

  const proof = await call("GET", `projects/${project.id}/proofs/1/file`, { cookie: a });
  assert.equal(proof.status, 200);
  assert.equal(new TextDecoder().decode(proof.bytes.slice(0, 5)), "%PDF-");
  assert.equal((await call("GET", `projects/${project.id}/proofs/1/file`, { cookie: b })).status, 404);
  assert.equal((await call("GET", `projects/${project.id}/final`, { cookie: a })).status, 409, "no final yet");

  const overview = await call("GET", "overview", { cookie: a });
  assert.equal(overview.json.totals.proofReady, 1);
  assert.equal(overview.json.totals.jobs, 1);
  assert.equal(overview.json.worker.online, true);

});

async function projectWithProof(cookie, pdf = makePdf()) {
  const project = await newProject(cookie);
  await call("POST", `projects/${project.id}/csv`, { cookie, form: csvForm() });
  assert.equal((await call("POST", `projects/${project.id}/submit`, { cookie, body: {} })).status, 202);
  await workerRenders(pdf);
  const r = await call("GET", `projects/${project.id}`, { cookie });
  assert.equal(r.json.project.status, "proof_ready");
  return r.json.project;
}

test("revision request, resubmit, new proof supersedes the old one", async () => {
  const a = await signUp("rev@acme.test");
  const project = await projectWithProof(a);
  assert.equal((await call("POST", `projects/${project.id}/proofs/1/revise`, { cookie: a, body: { notes: "" } })).status, 400, "notes required");
  const revised = await call("POST", `projects/${project.id}/proofs/1/revise`, { cookie: a, body: { notes: "Fix the Smith address" } });
  assert.equal(revised.json.project.status, "revision_requested");
  assert.equal(revised.json.project.proofs[0].notes, "Fix the Smith address");
  assert.equal((await call("POST", `projects/${project.id}/proofs/1/approve`, { cookie: a, body: {} })).status, 409, "cannot approve a revised proof");

  assert.equal((await call("POST", `projects/${project.id}/csv`, { cookie: a, form: csvForm(CSV + "Zed,Zoe,3 Fir St,555-0103,z@x.test\n") })).status, 200);
  assert.equal((await call("POST", `projects/${project.id}/submit`, { cookie: a, body: {} })).status, 202);
  await workerRenders(makePdf());
  const second = (await call("GET", `projects/${project.id}`, { cookie: a })).json.project;
  assert.equal(second.proofs.length, 2);
  assert.equal(second.proofs[1].decision, "pending");
  assert.equal((await call("GET", `projects/${project.id}/proofs/1/file`, { cookie: a })).status, 200, "previous versions stay viewable");
  assert.equal((await call("POST", `projects/${project.id}/proofs/1/approve`, { cookie: a, body: {} })).status, 409, "old proof stays unapprovable");
});

test("approval records who/when, validates and stores the final PDF, then locks the project", async () => {
  const a = await signUp("ok@acme.test");
  const b = await signUp("other@acme.test", "Other");
  const project = await projectWithProof(a);
  assert.equal((await call("POST", `projects/${project.id}/proofs/1/approve`, { cookie: b, body: {} })).status, 404, "other org cannot approve");
  assert.equal((await call("POST", `projects/${project.id}/proofs/1/approve`, { body: {} })).status, 401);

  const approved = await call("POST", `projects/${project.id}/proofs/1/approve`, { cookie: a, body: {} });
  assert.equal(approved.status, 200);
  const p = approved.json.project;
  assert.equal(p.status, "completed");
  assert.equal(p.proofs[0].decision, "approved");
  assert.equal(p.proofs[0].decidedBy, "ok@acme.test");
  assert.equal(p.finalFile.validation.ok, true);
  assert.equal(p.finalFile.validation.pages, 2);
  assert.ok(p.finalFile.validation.notChecked.includes("PDF/X conformance"), "does not overclaim");

  const final = await call("GET", `projects/${project.id}/final`, { cookie: a });
  assert.equal(final.status, 200);
  assert.equal((await call("GET", `projects/${project.id}/final`, { cookie: b })).status, 404);
  assert.equal((await call("POST", `projects/${project.id}/proofs/1/approve`, { cookie: a, body: {} })).status, 409, "no double approval");
  assert.equal((await call("POST", `projects/${project.id}/submit`, { cookie: a, body: {} })).status, 409, "locked");
  assert.equal((await call("PATCH", `projects/${project.id}`, { cookie: a, body: { name: "x" } })).status, 409, "locked");
  assert.equal((await call("POST", `projects/${project.id}/csv`, { cookie: a, form: csvForm() })).status, 409, "locked");
});

test("a PDF of the wrong size is approved but never offered as the final file", async () => {
  const a = await signUp("bad@acme.test");
  const project = await projectWithProof(a, makePdf({ width: 8.5, height: 11 }));
  const approved = await call("POST", `projects/${project.id}/proofs/1/approve`, { cookie: a, body: {} });
  assert.equal(approved.json.project.status, "approved", "not 'completed'");
  assert.equal(approved.json.project.finalFile.validation.ok, false);
  assert.equal(approved.json.project.finalFile.url, null);
  assert.match(approved.json.project.finalFile.validation.problems[0], /not 5\.5 × 8\.5 in|not 8\.5 × 11 in/);
  assert.equal((await call("GET", `projects/${project.id}/final`, { cookie: a })).status, 409);
});

test("duplicate copies settings and data; archive hides from totals", async () => {
  const cookie = await signUp("d@acme.test");
  const project = await newProject(cookie);
  await call("POST", `projects/${project.id}/csv`, { cookie, form: csvForm() });
  const copy = await call("POST", `projects/${project.id}/duplicate`, { cookie, body: {} });
  assert.equal(copy.status, 201);
  assert.equal(copy.json.project.status, "uploaded");
  assert.equal(copy.json.project.name, "Spring Directory (copy)");
  const detail = await call("GET", `projects/${copy.json.project.id}`, { cookie });
  assert.equal(detail.json.project.preview.rowCount, 2);

  await call("POST", `projects/${copy.json.project.id}/archive`, { cookie, body: { archived: true } });
  const overview = await call("GET", "overview", { cookie });
  assert.equal(overview.json.totals.drafts, 1);
});

test("org profile and default branding are inherited by new projects", async () => {
  const cookie = await signUp("o@acme.test");
  assert.equal((await call("PUT", "org/branding", { cookie, body: { colors: { accentColor: "nope" } } })).status, 400);
  const saved = await call("PUT", "org/branding", { cookie, body: { colors: { accentColor: "#112233" }, publicationTitle: "Members 2027" } });
  assert.equal(saved.json.org.branding.colors.accentColor, "#112233");
  const project = await newProject(cookie);
  assert.equal(project.brandColors.accentColor, "#112233");
  assert.equal(project.publicationTitle, "Members 2027");
  const patched = await call("PATCH", "org", { cookie, body: { phone: "555-1234", name: "Acme Print Co" } });
  assert.equal(patched.json.org.name, "Acme Print Co");
});

test("templates list only what a worker can run", async () => {
  const cookie = await signUp("tt@acme.test");
  const { templates } = (await call("GET", "templates", { cookie })).json;
  assert.deepEqual(templates.map((t) => t.id), ["directory-classic"]);
  assert.equal(templates[0].supports.photos, false);
  assert.equal((await call("POST", "projects", { cookie, body: { name: "x", templateId: "yearbook-modern" } })).status, 400);
});

test("a large PDF (>4.5 MB) streams through the real Node handler without being buffered, and stays org-scoped", async () => {
  const { createServer } = await import("node:http");
  const a = await signUp("big@acme.test");
  const b = await signUp("bigother@acme.test", "Other");
  const pdf = makePdf({ padBytes: 12 * 1024 * 1024 });
  assert.ok(pdf.length > 10 * 1024 * 1024, "well above Vercel's 4.5 MB response cap");
  const project = await projectWithProof(a, pdf);
  assert.equal((await call("POST", `projects/${project.id}/proofs/1/approve`, { cookie: a, body: {} })).json.project.status, "completed");

  const server = createServer((req, res) => platform(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/platform/projects/${project.id}`;
  try {
    for (const route of ["final", "proofs/1/file?download=1"]) {
      const ok = await fetch(`${base}/${route}`, { headers: { cookie: a } });
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("content-type"), "application/pdf");
      assert.equal(Number(ok.headers.get("content-length")), pdf.length, "length is declared up front");
      const body = new Uint8Array(await ok.arrayBuffer());
      assert.equal(body.length, pdf.length, "every byte arrives");
      assert.deepEqual(body.slice(-16), pdf.slice(-16));
      assert.equal((await fetch(`${base}/${route}`, { headers: { cookie: b } })).status, 404, "other org");
      assert.equal((await fetch(`${base}/${route}`)).status, 401, "anonymous");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

/* ── Large-PDF upload: the worker goes straight to Blob, the server verifies ──
   Local mode has no Blob, so the test plays Blob's part by writing the object
   itself. What is under test is the server's decision: it must look at what was
   stored, not believe the worker. */
async function claimJob() {
  const headers = { authorization: `Bearer ${workerToken}`, "content-type": "application/json" };
  const claimed = await claim(new Request(`${ORIGIN}/api/render-jobs/worker/claim`, { method: "POST", headers, body: JSON.stringify({ workerId: "mac-1" }) }));
  assert.equal(claimed.status, 200);
  return claimed.json();
}
const resultCall = (job, fields) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return result(new Request(`${ORIGIN}${job.resultUrl}`, { method: "POST", headers: { authorization: `Bearer ${workerToken}` }, body: form }));
};

test("direct upload: the server verifies the stored object before completing the job", async () => {
  const a = await signUp("direct@acme.test");
  const project = await newProject(a);
  await call("POST", `projects/${project.id}/csv`, { cookie: a, form: csvForm() });
  await call("POST", `projects/${project.id}/submit`, { cookie: a, body: {} });
  const job = await claimJob();

  /* Not available in local mode: says so, so the worker can fall back. */
  assert.equal((await resultCall(job, { status: "request_upload", workerId: "mac-1" })).status, 501);
  /* Only the worker holding the lease may ask. */
  assert.equal((await resultCall(job, { status: "request_upload", workerId: "intruder" })).status, 409);

  /* Claims an upload that never happened. */
  assert.equal((await resultCall(job, { status: "completed", workerId: "mac-1", uploaded: "true" })).status, 400);
  /* An object that is not a PDF is rejected AND removed. */
  await putOutputPdf(job.id ?? job.jobId, new TextEncoder().encode("<html>".repeat(200)));
  assert.equal((await resultCall(job, { status: "completed", workerId: "mac-1", uploaded: "true" })).status, 400);
  const still = await call("GET", `projects/${project.id}`, { cookie: a });
  assert.notEqual(still.json.project.status, "proof_ready", "a bad upload must not become a proof");
  /* Another worker cannot finish it. */
  await putOutputPdf(job.id ?? job.jobId, makePdf({ padBytes: 6 * 1024 * 1024 }));
  assert.equal((await resultCall(job, { status: "completed", workerId: "intruder", uploaded: "true" })).status, 409);

  /* The real thing: a >4.5 MB PDF is verified in place and completes. */
  const ok = await resultCall(job, { status: "completed", workerId: "mac-1", uploaded: "true" });
  assert.equal(ok.status, 200, await ok.clone().text());
  const after = await call("GET", `projects/${project.id}`, { cookie: a });
  assert.equal(after.json.project.status, "proof_ready");
  const proofFile = await call("GET", `projects/${project.id}/proofs/1/file`, { cookie: a });
  assert.ok(proofFile.bytes.length > 4.5 * 1024 * 1024, "the proof is the full >4.5 MB file");
});

test("a Vercel preview refuses to run until it is marked isolated from production storage", async () => {
  process.env.VERCEL_ENV = "preview";
  try {
    const blocked = await call("GET", "templates");
    assert.equal(blocked.status, 503);
    assert.match(blocked.json.error, /not marked isolated/);
    assert.equal((await call("POST", "register", { body: { email: "p@x.test", password: "correct horse battery", name: "P", companyName: "P" } })).status, 503, "nothing is written either");
    process.env.PRESSMARK_PREVIEW_ISOLATED = "1";
    assert.equal((await call("GET", "templates")).status, 401, "isolated preview behaves normally");
  } finally {
    delete process.env.VERCEL_ENV;
    delete process.env.PRESSMARK_PREVIEW_ISOLATED;
  }
});

/* ── Which Redis does the platform use? ── */
test("platform Redis selection: shared by default, dedicated only when both variables are set, never silently half-configured", async () => {
  const { platformRedisConfig, platformCommand } = await import("../lib/platform/redis.js");
  assert.equal(platformRedisConfig({}).mode, "shared");
  assert.equal(platformRedisConfig({ PLATFORM_REDIS_REST_URL: "https://x.upstash.io" }).mode, "invalid");
  assert.equal(platformRedisConfig({ PLATFORM_REDIS_REST_TOKEN: "t" }).mode, "invalid");
  assert.equal(platformRedisConfig({ PLATFORM_REDIS_REST_URL: "http://x.upstash.io", PLATFORM_REDIS_REST_TOKEN: "t" }).mode, "invalid", "https only");
  /* The license store's fallback name must not select the platform database. */
  assert.equal(platformRedisConfig({ UPSTASH_REDIS_REST_URL: "https://new.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }).mode, "shared");
  assert.equal(platformRedisConfig({ PLATFORM_REDIS_REST_URL: "https://new.upstash.io", PLATFORM_REDIS_REST_TOKEN: "t" }).mode, "dedicated");

  /* Local/test mode always uses the in-process emulation, whatever the variables say. */
  assert.equal(await platformCommand(["SET", "plat:probe", "1"]), "OK");
});

test("a dedicated platform Redis receives the platform's commands with ITS credentials, not the shared ones", async () => {
  const realEnv = { ...process.env };
  const { platformCommand } = await import("../lib/platform/redis.js");
  /* usingLocalKv() is true under test, so drive the REST path directly by
     lifting the test flag for just this call. */
  const savedNode = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const seen = [];
    const fetchImpl = async (url, init) => { seen.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) }); return new Response(JSON.stringify({ result: "OK" })); };
    const env = { KV_REST_API_URL: "https://old.upstash.io", KV_REST_API_TOKEN: "old-token", PLATFORM_REDIS_REST_URL: "https://new.upstash.io", PLATFORM_REDIS_REST_TOKEN: "new-token" };
    assert.equal(await platformCommand(["SET", "plat:user:1", "{}"], { env, fetchImpl }), "OK");
    assert.deepEqual(seen, [{ url: "https://new.upstash.io", auth: "Bearer new-token", body: ["SET", "plat:user:1", "{}"] }]);
    /* A half-configured pair throws rather than falling back to the shared database. */
    await assert.rejects(platformCommand(["GET", "x"], { env: { ...env, PLATFORM_REDIS_REST_TOKEN: "" }, fetchImpl }), /BOTH/);
    assert.equal(seen.length, 1, "nothing reached any database");
  } finally {
    process.env.NODE_ENV = savedNode;
    Object.assign(process.env, realEnv);
  }
});

/* ── Deployment limits ── */
test("the project stays within Vercel Hobby's 12 Node serverless functions", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const walk = async (dir) => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async (e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  }))).flat();
  const files = (await walk(path.resolve("api"))).filter((f) => f.endsWith(".js") && !path.basename(f).startsWith("_"));
  const node = [];
  for (const f of files) if (!/runtime:\s*['"]edge['"]/.test(await readFile(f, "utf8"))) node.push(path.relative(process.cwd(), f));
  assert.ok(node.length <= 12, `${node.length} Node functions (limit 12 on Hobby; Edge functions do not count):\n${node.join("\n")}`);
});

test("the single worker function serves every worker URL, keeps auth-before-method, and 404s the rest", async () => {
  const { createServer } = await import("node:http");
  const { createApi } = await import("../worker/api.mjs");
  const a = await signUp("route@acme.test");
  const project = await newProject(a);
  await call("POST", `projects/${project.id}/csv`, { cookie: a, form: csvForm() });
  await call("POST", `projects/${project.id}/submit`, { cookie: a, body: {} });

  const server = createServer((req, res) => worker(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    /* No token: 401 whatever the method, on every worker URL (the probe must not learn methods). */
    for (const u of ["claim", "status", `${"a".repeat(64)}/heartbeat`, `${"a".repeat(64)}/input`, `${"a".repeat(64)}/result`]) {
      assert.equal((await fetch(`${base}/api/render-jobs/worker/${u}`)).status, 401, u);
    }
    const auth = { authorization: `Bearer ${workerToken}` };
    assert.equal((await fetch(`${base}/api/render-jobs/worker/nope`, { headers: auth })).status, 404);
    assert.equal((await fetch(`${base}/api/render-jobs/worker/claim/extra`, { headers: auth })).status, 404);

    /* The real worker client, over real HTTP, through the one function. */
    const api = createApi({ apiUrl: base, token: workerToken, workerId: "mac-1" });
    const job = await api.claim();
    assert.ok(job?.jobId, "claimed");
    assert.equal(await api.heartbeat(job.jobId, { progress: 10 }), true);
    assert.match((await api.downloadInput(job.jobId)).toString("utf8"), /last_name/);
    const done = await api.complete(job.jobId, Buffer.from(makePdf()));
    assert.equal(done.status, "completed");
    assert.equal((await call("GET", `projects/${project.id}`, { cookie: a })).json.project.status, "proof_ready");
    assert.ok((await (await fetch(`${base}/api/render-jobs/worker/status`, { headers: auth })).json()), "status answers");
  } finally {
    await new Promise((r) => server.close(r));
  }
});
