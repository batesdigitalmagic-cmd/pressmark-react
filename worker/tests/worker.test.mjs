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
import { indesignDialogState, parseDialogProbe, runInDesignJob, swatchHandoff, verifyPdf, writeHandoff } from "../indesign.mjs";

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

/* ── Brand colours ── */

test("brand colours become swatch lines the ExtendScript can parse", () => {
  /* The key names the swatch, so the script needs no list of its own. */
  assert.deepEqual(swatchHandoff({ primaryColor: "#7A1F35", lightTint: "#E6E6E6" }), {
    "swatch.PM_Primary": "0,75,57,52",
    "swatch.PM_LightTint": "0,0,0,10",
  });

  /* Pure black is K only. A rich black under body text and hairline rules is a
     production mistake, so the conversion must not produce one. */
  assert.equal(swatchHandoff({ textColor: "#000000" })["swatch.PM_Text"], "0,0,0,100");
  assert.equal(swatchHandoff({ backgroundColor: "#FFFFFF" })["swatch.PM_Background"], "0,0,0,0");

  /* Every value is a single line of digits and commas — the handoff format has
     no escaping, so anything else would corrupt the file the script parses. */
  const all = swatchHandoff({
    primaryColor: "#12ab34",
    secondaryColor: "#FE0102",
    accentColor: "#0099FF",
    textColor: "#111111",
    backgroundColor: "#FAFAFA",
    lightTint: "#DDDDDD",
  });
  assert.equal(Object.keys(all).length, 6);
  for (const [key, value] of Object.entries(all)) {
    assert.match(key, /^swatch\.PM_[A-Za-z]+$/);
    assert.match(value, /^\d{1,3},\d{1,3},\d{1,3},\d{1,3}$/);
  }

  /* The normal case: the customer changed nothing, so the document is never
     touched and the template renders in its own colours. */
  assert.deepEqual(swatchHandoff({}), {});
  assert.deepEqual(swatchHandoff(undefined), {});

  /* A key we do not know, or a value that is not a colour, means the server and
     this file disagree about what a validated job looks like. Fail loudly
     rather than paint a directory in something nobody chose. */
  assert.throws(() => swatchHandoff({ borderColor: "#7A1F35" }), /unknown brand colour/);
  assert.throws(() => swatchHandoff({ primaryColor: "puce" }), /not a six-digit hex/);
});

test("a render works on a copy of the template, never the operator's file", async () => {
  const jobDir = await mkdtemp(path.join(tmp, "copyjob-"));
  const template = path.join(tmp, "production-template.indd");
  const original = `INDD${"x".repeat(200)}`;
  await writeFile(template, original);

  /*
   * No InDesign, on purpose. A bundle id nothing answers to makes osascript
   * fail immediately, which is all this test needs: the copy and the handoff
   * are written BEFORE osascript is invoked, so the failure path still proves
   * the operator's template was never opened.
   */
  const outcome = await runInDesignJob(
    {
      templatePath: template,
      scriptPath: path.join(tmp, "nothing.jsx"),
      handoffPath: path.join(jobDir, "handoff.txt"),
      indesignBundleId: "test.pressmark.no-such-application",
      renderTimeoutMs: 10000,
    },
    {
      jobId: "b".repeat(64),
      jobDir,
      csvPath: path.join(jobDir, "input.csv"),
      pdfPath: path.join(jobDir, "out.pdf"),
      resultPath: path.join(jobDir, "result.txt"),
      brandColors: { primaryColor: "#7A1F35" },
    }
  );

  /* No result file, because nothing ran — reported as a failure the worker may
     retry rather than as a render that failed. */
  assert.equal(outcome.status, "failed");
  assert.ok(existsSync(path.join(jobDir, "template.indd")), "the per-job copy should exist");
  assert.equal(await readFile(template, "utf8"), original, "the source template must be byte-identical");
});

/* ── Never claim a job InDesign cannot run ── */

test("the dialog probe's output is read strictly", () => {
  assert.equal(parseDialogProbe("free"), "free");
  assert.equal(parseDialogProbe("blocked\n"), "blocked");
  /* Anything else is inconclusive, and inconclusive must not hold work back. */
  assert.equal(parseDialogProbe(""), "unknown");
  assert.equal(parseDialogProbe("execution error: -1708"), "unknown");
});

test("a closed InDesign is never launched just to be checked", async () => {
  const sent = [];
  const exec = async (script) => {
    sent.push(script);
    return { ok: true, stdout: "false\n" };
  };
  assert.equal(await indesignDialogState({ indesignBundleId: "com.adobe.InDesign" }, { exec }), "not-running");
  /* `is running` does not start an application; `do script` would. Only the
     first may be sent when InDesign is closed. */
  assert.equal(sent.length, 1);
  assert.match(sent[0], /is running$/);
});

test("a running InDesign is probed, and its answer is reported", async () => {
  const replies = [{ ok: true, stdout: "true\n" }, { ok: true, stdout: "blocked\n" }];
  const exec = async () => replies.shift();
  assert.equal(await indesignDialogState({ indesignBundleId: "com.adobe.InDesign" }, { exec }), "blocked");

  const failing = async () => ({ ok: false, stdout: "" });
  assert.equal(await indesignDialogState({ indesignBundleId: "com.adobe.InDesign" }, { exec: failing }), "unknown");
});

async function decide({ status, dialog }) {
  const { readyForWork } = await import("../pressmark-worker.mjs");
  let probed = 0;
  const api = { status: async () => status };
  const indesign = {
    indesignDialogState: async () => {
      probed += 1;
      return dialog;
    },
  };
  const verdict = await readyForWork(api, {}, indesign);
  return { ...verdict, probed };
}

test("with an open dialog, a queued job is left on the queue", async () => {
  /* The failure this exists for: a forgotten dialog used to burn all three of a
     customer's attempts in about two seconds. */
  const verdict = await decide({ status: { queued: 1, active: 0 }, dialog: "blocked" });
  assert.equal(verdict.take, false);
  assert.equal(verdict.reason, "blocked");
});

test("with InDesign free, or closed, or unreadable, the worker takes the job", async () => {
  for (const dialog of ["free", "not-running", "unknown"]) {
    const verdict = await decide({ status: { queued: 2, active: 0 }, dialog });
    assert.equal(verdict.take, true, `expected to take work when InDesign is ${dialog}`);
  }
});

test("an idle worker leaves InDesign alone", async () => {
  /* Nothing queued, nothing held: no probe, so someone designing on this Mac is
     not interrupted every few seconds by a worker with nothing to do. */
  const verdict = await decide({ status: { queued: 0, active: 0 }, dialog: "blocked" });
  assert.equal(verdict.take, false);
  assert.equal(verdict.reason, "idle");
  assert.equal(verdict.probed, 0);
});

test("a held job still gets the claim that recovers a crashed worker's lease", async () => {
  /* active > 0 with an empty queue is a lease that may need recovering, and the
     claim endpoint is what runs that recovery. */
  const verdict = await decide({ status: { queued: 0, active: 1 }, dialog: "free" });
  assert.equal(verdict.take, true);
});

test("if the queue cannot be read, the worker falls back to claiming as before", async () => {
  const verdict = await decide({ status: null, dialog: "free" });
  assert.equal(verdict.take, true);
});

/* ── The job loop ──
   InDesign is injected so each outcome it can produce is exercised for real. */

async function runProcessJob({ renderOutcome, pdfContents, apiOverrides = {} }) {
  const workDir = await mkdtemp(path.join(tmp, "work-"));
  const calls = { completed: null, failed: null, heartbeats: 0, rendered: null };

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
      calls.rendered = job;
      if (pdfContents !== undefined) await writeFile(job.pdfPath, pdfContents);
      return { pdfPath: job.pdfPath, ...renderOutcome };
    },
    verifyPdf,
  };

  const { processJob } = await import("../pressmark-worker.mjs");
  await processJob(
    api,
    config,
    {
      jobId: "a".repeat(64),
      rowCount: 2,
      attempts: 1,
      brandColors: { primaryColor: "#22503C", lightTint: "#B08A78" },
    },
    indesign
  );

  return { calls, workDir, rendered: calls.rendered };
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

test("the colours chosen on the site are the colours handed to InDesign", async () => {
  const { rendered } = await runProcessJob({
    renderOutcome: { status: "completed", message: "", timedOut: false },
    pdfContents: `%PDF-1.5\n${"x".repeat(800)}`,
  });
  assert.deepEqual(rendered.brandColors, { primaryColor: "#22503C", lightTint: "#B08A78" });
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
