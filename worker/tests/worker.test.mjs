/*
 * Worker unit tests.
 *
 * These do NOT launch InDesign — the application is not available in CI and a
 * test that depends on it would be skipped everywhere it mattered. What is
 * tested here is everything AROUND the render: configuration, redaction, the
 * handoff contract, PDF verification, and the job loop's behaviour when a
 * render succeeds, fails, times out, or loses its lease.
 *
 * The InDesign call itself is injected, so the loop is exercised for real
 * against each outcome InDesign can produce.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, loadConfig, validateConfig } from "../config.mjs";
import { log, redact, shortJobId } from "../log.mjs";
import { verifyPdf, writeHandoff } from "../indesign.mjs";

const TOKEN = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let tmp;
test.before(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "pressmark-worker-test-"));
});
test.after(async () => rm(tmp, { recursive: true, force: true }));

/* ── Configuration ── */

test("configuration reports every missing requirement", () => {
  const problems = validateConfig(loadConfig({}));
  assert.ok(problems.some((p) => /PRESSMARK_API_URL/.test(p)));
  assert.ok(problems.some((p) => /PRESSMARK_WORKER_TOKEN/.test(p)));
  assert.ok(problems.some((p) => /PRESSMARK_INDD_TEMPLATE/.test(p)));
});

test("a complete configuration validates", () => {
  const config = loadConfig({
    PRESSMARK_API_URL: "https://pressmark.example/",
    PRESSMARK_WORKER_TOKEN: TOKEN,
    PRESSMARK_INDD_TEMPLATE: "/Users/x/church-directory-classic.indd",
  });
  assert.deepEqual(validateConfig(config), []);
  /* A trailing slash would produce "//api/..." on every request. */
  assert.equal(config.apiUrl, "https://pressmark.example");
});

test("an obviously wrong token or URL is rejected before the worker starts", () => {
  const shortToken = validateConfig(
    loadConfig({ PRESSMARK_API_URL: "https://x.test", PRESSMARK_WORKER_TOKEN: "abc", PRESSMARK_INDD_TEMPLATE: "/t.indd" })
  );
  assert.ok(shortToken.some((p) => /too short/.test(p)));

  const badUrl = validateConfig(
    loadConfig({ PRESSMARK_API_URL: "pressmark.example", PRESSMARK_WORKER_TOKEN: TOKEN, PRESSMARK_INDD_TEMPLATE: "/t.indd" })
  );
  assert.ok(badUrl.some((p) => /http/.test(p)));
});

test("neither the token nor its length reaches any output", () => {
  const config = loadConfig({
    PRESSMARK_API_URL: "https://x.test",
    PRESSMARK_WORKER_TOKEN: TOKEN,
    PRESSMARK_INDD_TEMPLATE: "/t.indd",
  });
  const shown = JSON.stringify(describe(config));
  assert.doesNotMatch(shown, new RegExp(TOKEN), "the token must never appear in describe() output");
  assert.match(shown, /"tokenConfigured":true/);
  /*
   * Regression: describe() reported tokenLength, and the worker logs this
   * object verbatim on every start — so the length reached the log file,
   * launchd's stdout, and any screenshot of a startup line.
   */
  assert.doesNotMatch(shown, /tokenLength/, "the token's length must not be reported either");
  assert.doesNotMatch(shown, /\b64\b/, "no field may carry the token's length");
});

/* ── Redaction ── */

test("redaction removes tokens, bearer headers and email addresses", () => {
  assert.doesNotMatch(redact(`Authorization: Bearer ${TOKEN}`), new RegExp(TOKEN));
  assert.doesNotMatch(redact(`token=${TOKEN}`), new RegExp(TOKEN));
  assert.equal(redact("contact ava.whitfield@example.org today"), "contact <redacted-email> today");
});

test("log lines never carry the token or a CSV value", () => {
  const written = [];
  const original = process.stdout.write;
  process.stdout.write = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  try {
    log.info("Job claimed", { job: shortJobId("f".repeat(64)), detail: `Bearer ${TOKEN}` });
  } finally {
    process.stdout.write = original;
  }
  const line = written.join("");
  assert.doesNotMatch(line, new RegExp(TOKEN));
  assert.match(line, /"job":"ffffffff"/, "the job id is truncated, not redacted away");
  assert.match(line, /"level":"info"/);
  JSON.parse(line);
});

/* ── The handoff contract ── */

test("the handoff file is written as key=value lines the JSX can parse", async () => {
  const handoff = path.join(tmp, "handoff", "current-render-job.txt");
  await writeHandoff(handoff, {
    jobId: "abc123",
    template: "/Users/x/church-directory-classic.indd",
    csv: "/tmp/job-1/input.csv",
    output: "/tmp/job-1/out.pdf",
    result: "/tmp/job-1/result.txt",
  });
  const text = await readFile(handoff, "utf8");
  assert.match(text, /^jobId=abc123$/m);
  assert.match(text, /^template=\/Users\/x\/church-directory-classic\.indd$/m);
  assert.match(text, /^result=\/tmp\/job-1\/result\.txt$/m);
  /* Every line must split on its FIRST "=" only. */
  for (const line of text.trim().split("\n")) assert.ok(line.indexOf("=") > 0);
});

test("a path containing a newline is refused rather than silently truncated", async () => {
  await assert.rejects(
    () => writeHandoff(path.join(tmp, "bad.txt"), { jobId: "x", csv: "/tmp/a\nb.csv" }),
    /newline/
  );
});

/* ── PDF verification ── */

test("only a real, non-trivial PDF is accepted", async () => {
  const missing = path.join(tmp, "nope.pdf");
  assert.equal((await verifyPdf(missing)).ok, false);

  const empty = path.join(tmp, "empty.pdf");
  await writeFile(empty, "");
  const emptyResult = await verifyPdf(empty);
  assert.equal(emptyResult.ok, false);
  assert.match(emptyResult.reason, /empty|not written/);

  const html = path.join(tmp, "html.pdf");
  await writeFile(html, "<html>gateway timeout</html>".padEnd(600, " "));
  const htmlResult = await verifyPdf(html);
  assert.equal(htmlResult.ok, false);
  assert.match(htmlResult.reason, /not a PDF/);

  const real = path.join(tmp, "real.pdf");
  await writeFile(real, `%PDF-1.5\n${"x".repeat(600)}`);
  const realResult = await verifyPdf(real);
  assert.equal(realResult.ok, true);
  assert.ok(realResult.bytes.length > 400);
});

/* ── The job loop ──
   InDesign is injected so each outcome it can produce is exercised for real. */

async function runProcessJob({ renderOutcome, pdfContents, apiOverrides = {} }) {
  const workDir = await mkdtemp(path.join(tmp, "work-"));
  const calls = { completed: null, failed: null, heartbeats: 0 };

  const api = {
    async downloadInput() {
      return Buffer.from("last_name,first_name\nAlpha,Ben\n");
    },
    async heartbeat() {
      calls.heartbeats += 1;
      return true;
    },
    async complete(jobId, bytes) {
      calls.completed = { jobId, bytes };
      return { status: "completed" };
    },
    async fail(jobId, message) {
      calls.failed = { jobId, message };
      return { status: "failed" };
    },
    ...apiOverrides,
  };

  const config = {
    ...loadConfig({
      PRESSMARK_API_URL: "https://x.test",
      PRESSMARK_WORKER_TOKEN: TOKEN,
      PRESSMARK_INDD_TEMPLATE: "/t.indd",
    }),
    workDir,
    heartbeatMs: 5000,
  };

  /* Stand in for InDesign: write whatever the scenario says, report the given
     outcome. Everything else in processJob runs unmodified. */
  const indesign = {
    async runInDesignJob(_config, job) {
      if (pdfContents !== undefined) await writeFile(job.pdfPath, pdfContents);
      return { pdfPath: job.pdfPath, ...renderOutcome };
    },
    verifyPdf,
  };

  const { processJob } = await import("../pressmark-worker.mjs");
  await processJob(api, config, { jobId: "a".repeat(64), rowCount: 2, attempts: 1 }, indesign);

  return { calls, workDir };
}

test("a successful render uploads the PDF and completes the job", async () => {
  const { calls, workDir } = await runProcessJob({
    renderOutcome: { status: "completed", message: "", timedOut: false },
    pdfContents: `%PDF-1.5\n${"x".repeat(800)}`,
  });
  assert.ok(calls.completed, "the job should be completed");
  assert.equal(calls.failed, null);
  assert.match(calls.completed.bytes.subarray(0, 5).toString(), /^%PDF-/);
  assert.deepEqual(await listDirs(workDir), [], "the job directory must be removed");
});

test("a render that InDesign reports as failed fails the job", async () => {
  const { calls } = await runProcessJob({
    renderOutcome: { status: "failed", message: "Failed while merging all records. Missing font.", timedOut: false },
  });
  assert.equal(calls.completed, null);
  assert.match(calls.failed.message, /Missing font/);
});

test("a timeout is reported as a timeout, not as a render failure", async () => {
  const { calls } = await runProcessJob({
    renderOutcome: { status: "failed", message: "", timedOut: true },
  });
  assert.match(calls.failed.message, /longer than the time allowed/);
});

test("a render that produces an unusable PDF is failed, never uploaded", async () => {
  const { calls } = await runProcessJob({
    renderOutcome: { status: "completed", message: "", timedOut: false },
    pdfContents: "<html>not a pdf</html>".padEnd(600, " "),
  });
  assert.equal(calls.completed, null, "an invalid PDF must never be uploaded");
  assert.match(calls.failed.message, /not a PDF/);
});

test("a job whose lease was lost is neither uploaded nor failed", async () => {
  const { calls } = await runProcessJob({
    renderOutcome: { status: "completed", message: "", timedOut: false },
    pdfContents: `%PDF-1.5\n${"x".repeat(800)}`,
    /* The server says the job is no longer ours. */
    apiOverrides: { async heartbeat() { return false; } },
  });
  assert.equal(calls.completed, null, "a lost lease must not upload");
  assert.equal(calls.failed, null, "and must not fail a job another worker now owns");
});

test("customer files are removed even when the render throws", async () => {
  const workDirs = [];
  const { calls, workDir } = await runProcessJob({
    renderOutcome: { status: "completed", message: "", timedOut: false },
    pdfContents: `%PDF-1.5\n${"x".repeat(800)}`,
    apiOverrides: {
      async downloadInput() {
        throw new Error("network died mid-download");
      },
    },
  });
  workDirs.push(workDir);
  assert.ok(calls.failed, "the job should be failed so it can be retried");
  assert.deepEqual(await listDirs(workDir), [], "no customer CSV may be left on disk");
});

async function listDirs(root) {
  if (!existsSync(root)) return [];
  const { readdir } = await import("node:fs/promises");
  return readdir(root);
}
