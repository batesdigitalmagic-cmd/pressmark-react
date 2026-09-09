import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import submit from "../api/render-jobs/index.js";
import status from "../api/render-jobs/[jobId].js";
import download from "../api/render-jobs/[jobId]/download.js";
import claim from "../api/render-jobs/worker/claim.js";
import input from "../api/render-jobs/worker/[jobId]/input.js";
import heartbeat from "../api/render-jobs/worker/[jobId]/heartbeat.js";
import result from "../api/render-jobs/worker/[jobId]/result.js";
import cleanup from "../api/render-jobs/cleanup.js";
import { __resetLocalKv, command } from "../lib/render-jobs/kv.js";
import {
  JOB_STATUSES,
  readJob,
  recoverExpiredLeases,
} from "../lib/render-jobs/jobs.js";
import { readInputCsv, readOutputPdf } from "../lib/render-jobs/blob.js";
import { validateAndNormalizeCsv } from "../lib/render-jobs/csv.js";
import { modeForTemplate, templateFor } from "../src/instant-proof/templates/registry.js";

const encoder = new TextEncoder();
const token = "test-worker-token-with-enough-entropy";
let root;
test.before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "pressmark-render-test-"));
  process.env.NODE_ENV = "test";
  process.env.PRESSMARK_RENDER_LOCAL_DIR = root;
  process.env.PRESSMARK_WORKER_TOKEN = token;
});
test.after(async () => rm(root, { recursive: true, force: true }));

test("CSV validation normalizes BOM, rejects headers, and sorts names", () => {
  const valid = validateAndNormalizeCsv(encoder.encode("\uFEFFlast_name,first_name,email\nZulu,Amy,a@x.test\nalpha,Zed,z@x.test\nAlpha,Amy,b@x.test\n"));
  assert.equal(valid.rowCount, 3);
  assert.deepEqual(valid.records.map((row) => `${row.last_name}:${row.first_name}`), ["Alpha:Amy", "alpha:Zed", "Zulu:Amy"]);
  assert.throws(() => validateAndNormalizeCsv(encoder.encode("last_name,bogus\nSmith,Amy\n")), /Missing required headers: first_name.*Unsupported headers: bogus/);
  assert.throws(() => validateAndNormalizeCsv(encoder.encode('last_name,first_name\n"Smith,Amy\n')), /not closed/);
});

test("template capabilities route Directory Classic to CSV and keep photo templates photo-based", async () => {
  assert.equal(templateFor("directory-classic").inputMode, "csv");
  assert.equal(templateFor("photo-gallery").inputMode, "photos");
  assert.equal(templateFor("yearbook-modern").inputMode, "photos");
  const uploadSource = await readFile("src/instant-proof/components/UploadStep.jsx", "utf8");
  const createSource = await readFile("src/instant-proof/components/CreateStep.jsx", "utf8");
  const pageSource = await readFile("src/pages/InstantProof.jsx", "utf8");
  assert.match(uploadSource, /const photoMode = inputMode === "photos"/);
  assert.doesNotMatch(uploadSource, /templateId === "directory-classic"/);
  assert.match(createSource, /inputMode !== "csv"/);

  /*
   * Directory Classic renders its free proof in the browser like every other
   * design; the InDesign queue is an optional follow-on offered afterwards.
   *
   * This used to assert the opposite — that the page carried
   * `usesDirectoryQueue = Boolean(renderJobId) || inputMode === "csv"`, routing
   * every spreadsheet visitor straight to the queue. That made the free proof a
   * 503 in production, where getRenderJobStorage() fails closed.
   */
  assert.doesNotMatch(pageSource, /usesDirectoryQueue/);
  assert.match(pageSource, /resumingRenderJob/);

  /*
   * The queue view is reached ONLY by resuming a job from ?job=..., never by
   * choosing a CSV design.
   */
  assert.doesNotMatch(pageSource, /resumingRenderJob\s*=\s*[^;]*inputMode/);

  /* The build method follows the design, because the mode selector is hidden
     for CSV designs and would otherwise keep its `photo` default — which makes
     recordsFor() read photographs out of a spreadsheet project. */
  assert.equal(modeForTemplate("directory-classic"), "data");
  assert.equal(modeForTemplate("photo-gallery"), "photo");
});

/*
 * Simulate a worker's Mac dying.
 *
 * The lease is a Redis key with a TTL; a crashed worker stops renewing it and
 * it evaporates. Deleting it directly is exactly what the TTL does, without the
 * test waiting two minutes for it.
 */
async function deleteClaimKey(jobId) {
  await command(["DEL", `renderjob:claim:${jobId}`]);
}

/*
 * Simulate the retention window elapsing.
 *
 * Two things happen when 48 hours really pass: the record's TTL fires and Redis
 * drops it, and the job's index score falls into the past. The blob objects
 * have no TTL and survive both — that orphan is exactly what cleanup exists to
 * collect — so this reproduces the pair and leaves the files alone.
 */
async function expireJobRecord(jobId) {
  await command(["ZADD", "renderjob:index", String(Date.now() - 1000), jobId]);
  await command(["DEL", `renderjob:job:${jobId}`]);
}

function workerRequest(url, method = "POST", body, workerId = "worker-a") {
  const headers = { Authorization: `Bearer ${token}` };
  if (body === undefined) {
    return new Request(url, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify({ workerId }),
    });
  }
  return new Request(url, { method, headers, body });
}

/** Submit one directory CSV and return the created public job. */
async function submitJob(csv = "last_name,first_name\nZulu,Amy\nAlpha,Ben\n", filename = "members.csv") {
  const form = new FormData();
  form.set("templateId", "directory-classic");
  form.set("csv", new Blob([csv], { type: "text/csv" }), filename);
  const response = await submit(new Request("http://local/api/render-jobs", { method: "POST", body: form }));
  return { response, job: await response.json() };
}

async function claimAs(workerId) {
  const response = await claim(workerRequest("http://local/api/render-jobs/worker/claim", "POST", undefined, workerId));
  return { response, job: response.status === 200 ? await response.json() : null };
}

function completionForm(pdfBytes, workerId = "worker-a", mockOutput = false) {
  const form = new FormData();
  form.set("status", "completed");
  form.set("workerId", workerId);
  if (mockOutput) form.set("mockOutput", "true");
  form.set("pdf", new Blob([pdfBytes], { type: "application/pdf" }), "proof.pdf");
  return form;
}

const samplePdf = () => readFile("public/proof-templates/directory-classic/preview.pdf");

/* Each test starts from an empty queue and an empty store, so a job left behind
   by one cannot be claimed by the next. */
test.beforeEach(() => __resetLocalKv());

/* ── Submission validation ── */

test("submission rejects unsupported templates and malformed CSVs", async () => {
  const wrongTemplate = new FormData();
  wrongTemplate.set("templateId", "yearbook-modern");
  wrongTemplate.set("csv", new Blob(["last_name,first_name\nSmith,Amy\n"], { type: "text/csv" }), "m.csv");
  const rejected = await submit(new Request("http://local/api/render-jobs", { method: "POST", body: wrongTemplate }));
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /Only Directory Classic/);

  const empty = new FormData();
  empty.set("templateId", "directory-classic");
  empty.set("csv", new Blob([""], { type: "text/csv" }), "m.csv");
  assert.equal((await submit(new Request("http://local/api/render-jobs", { method: "POST", body: empty }))).status, 413);

  const badHeaders = await submitJob("last_name,bogus\nSmith,Amy\n");
  assert.equal(badHeaders.response.status, 400);
  assert.match(badHeaders.job.error, /Unsupported headers: bogus/);

  const notCsv = new FormData();
  notCsv.set("templateId", "directory-classic");
  notCsv.set("csv", new Blob(["x"], { type: "text/csv" }), "members.txt");
  assert.equal((await submit(new Request("http://local/api/render-jobs", { method: "POST", body: notCsv }))).status, 400);
});

test("a submitted job is queued with a high-entropy id and a sanitized filename", async () => {
  const { response, job } = await submitJob(undefined, "../../members.csv");
  assert.equal(response.status, 201);
  assert.match(job.jobId, /^[a-f0-9]{64}$/);
  assert.equal(job.originalFilename, "members.csv");
  assert.equal(job.status, JOB_STATUSES.queued);
  assert.equal(job.stage, "queued");
  assert.equal(job.rowCount, 2);
});

/* ── Private storage ── */

test("the CSV is stored privately and is never exposed to the customer", async () => {
  const { job } = await submitJob();

  /* Stored, and readable only through the server-side adapter. */
  const stored = await readInputCsv(job.jobId);
  assert.ok(stored && stored.length > 0);
  assert.match(new TextDecoder().decode(stored), /^last_name,first_name/);

  /* The customer's view carries no storage path and no operational field. */
  const publicView = await (await status(new Request(`http://local/api/render-jobs/${job.jobId}`))).json();
  const serialized = JSON.stringify(publicView);
  for (const leak of ["csvKey", "pdfKey", "workerId", "leaseExpiresAt", "heartbeatAt", "attempts", "render-jobs/"]) {
    assert.doesNotMatch(serialized, new RegExp(leak), `public job leaked ${leak}`);
  }

  /* Reading the input requires the worker token. */
  assert.equal((await input(new Request(`http://local/api/render-jobs/worker/${job.jobId}/input`))).status, 401);
});

/* ── Authorization ── */

test("every worker endpoint refuses an absent or wrong token", async () => {
  const { job } = await submitJob();
  const unauth = (url, method = "POST") => new Request(url, { method });
  const wrong = (url, method = "POST") =>
    new Request(url, { method, headers: { Authorization: "Bearer not-the-token" } });

  assert.equal((await claim(unauth("http://local/api/render-jobs/worker/claim"))).status, 401);
  assert.equal((await claim(wrong("http://local/api/render-jobs/worker/claim"))).status, 401);
  assert.equal((await input(unauth(`http://local/api/render-jobs/worker/${job.jobId}/input`, "GET"))).status, 401);
  assert.equal((await heartbeat(unauth(`http://local/api/render-jobs/worker/${job.jobId}/heartbeat`))).status, 401);
  assert.equal((await result(unauth(`http://local/api/render-jobs/worker/${job.jobId}/result`))).status, 401);
  assert.equal((await cleanup(unauth("http://local/api/render-jobs/cleanup"))).status, 401);
});

test("a bad token is rejected before the method is considered", async () => {
  /*
   * Regression: every worker endpoint used to check the method first, so a GET
   * with a junk token answered 405 without the token ever being examined. The
   * worker's own health check probes with exactly such a GET, and therefore
   * reported an invalid token as "authorized" — a false green on the one check
   * an operator relies on to know the worker can talk to the site.
   *
   * Auth first also stops an anonymous caller enumerating which methods an
   * endpoint implements.
   */
  const wrongToken = { Authorization: "Bearer not-the-token" };
  const wrongMethod = (url) => new Request(url, { method: "GET", headers: wrongToken });

  assert.equal((await claim(wrongMethod("http://local/api/render-jobs/worker/claim"))).status, 401);
  assert.equal((await cleanup(wrongMethod("http://local/api/render-jobs/cleanup"))).status, 401);
  assert.equal(
    (await heartbeat(wrongMethod(`http://local/api/render-jobs/worker/${"a".repeat(64)}/heartbeat`))).status,
    401
  );
  assert.equal(
    (await result(wrongMethod(`http://local/api/render-jobs/worker/${"a".repeat(64)}/result`))).status,
    401
  );

  /* And with the RIGHT token, the wrong method still gets 405 — so the health
     probe can tell a good token from a bad one by 405 versus 401. */
  const rightToken = { Authorization: `Bearer ${token}` };
  assert.equal(
    (await claim(new Request("http://local/api/render-jobs/worker/claim", { method: "GET", headers: rightToken }))).status,
    405
  );
});

/* ── Atomic claim ── */

test("only one worker can claim a queued job", async () => {
  const { job } = await submitJob();

  const first = await claimAs("worker-a");
  const second = await claimAs("worker-b");

  assert.equal(first.response.status, 200);
  assert.equal(first.job.jobId, job.jobId);
  assert.equal(first.job.status, JOB_STATUSES.claimed);
  assert.equal(first.job.workerId, "worker-a");
  assert.equal(first.job.attempts, 1);

  /* 204: the queue is empty, not an error. */
  assert.equal(second.response.status, 204);
});

test("concurrent claims hand one job to exactly one worker", async () => {
  await submitJob();

  const racers = await Promise.all(
    ["w1", "w2", "w3", "w4", "w5"].map((id) => claimAs(id))
  );
  const winners = racers.filter((entry) => entry.response.status === 200);
  assert.equal(winners.length, 1, "exactly one worker should win the job");
  assert.equal(racers.filter((entry) => entry.response.status === 204).length, 4);
});

test("a claim requires a worker id", async () => {
  await submitJob();
  const response = await claim(
    new Request("http://local/api/render-jobs/worker/claim", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
  );
  assert.equal(response.status, 400);
});

/* ── Leases ── */

test("the lease renews for its owner and is refused to anyone else", async () => {
  const { job } = await submitJob();
  await claimAs("worker-a");

  const mine = await heartbeat(
    new Request(`http://local/api/render-jobs/worker/${job.jobId}/heartbeat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: "worker-a", progress: 50, progressMessage: "Merging", rendering: true }),
    })
  );
  assert.equal(mine.status, 200);

  const renewed = await readJob(job.jobId);
  assert.equal(renewed.status, JOB_STATUSES.rendering);
  assert.equal(renewed.progress, 50);

  /* The customer sees "rendering" for both claimed and rendering. */
  const publicView = await (await status(new Request(`http://local/api/render-jobs/${job.jobId}`))).json();
  assert.equal(publicView.stage, "rendering");

  const theirs = await heartbeat(
    new Request(`http://local/api/render-jobs/worker/${job.jobId}/heartbeat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: "worker-b" }),
    })
  );
  assert.equal(theirs.status, 409, "a worker that does not hold the lease must be refused");
});

test("an expired lease is recovered and the job is offered again", async () => {
  const { job } = await submitJob();
  const first = await claimAs("worker-a");
  assert.equal(first.response.status, 200);

  /* Nobody else can have it while the lease is held. */
  assert.equal((await claimAs("worker-b")).response.status, 204);

  /* Simulate the worker's Mac dying: its lease key expires. Deleting the claim
     key is exactly what the TTL does, without waiting two minutes. */
  await deleteClaimKey(job.jobId);

  const recovery = await recoverExpiredLeases();
  assert.equal(recovery.recovered, 1);
  assert.equal((await readJob(job.jobId)).status, JOB_STATUSES.queued);

  const second = await claimAs("worker-b");
  assert.equal(second.response.status, 200);
  assert.equal(second.job.workerId, "worker-b");
  assert.equal(second.job.attempts, 2, "the retry must count as a second attempt");
});

test("a job that exhausts its attempts fails instead of looping for ever", async () => {
  const { job } = await submitJob();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const claimed = await claimAs(`worker-${attempt}`);
    assert.equal(claimed.response.status, 200, `attempt ${attempt} should claim`);
    await deleteClaimKey(job.jobId);
    await recoverExpiredLeases();
  }

  const finished = await readJob(job.jobId);
  assert.equal(finished.status, JOB_STATUSES.failed);
  assert.match(finished.errorMessage, /stopped responding/);
  assert.equal((await claimAs("worker-x")).response.status, 204, "a failed job must not be re-offered");
});

/* ── Completion ── */

test("completion stores the PDF, is idempotent, and gates the download", async () => {
  const { job } = await submitJob();
  await claimAs("worker-a");
  const pdf = await samplePdf();

  /* Not ready yet. */
  assert.equal((await download(new Request(`http://local/api/render-jobs/${job.jobId}/download`))).status, 409);

  const first = await result(
    workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", completionForm(pdf))
  );
  assert.equal(first.status, 200);
  assert.equal((await first.json()).status, JOB_STATUSES.completed);

  /* Called twice — the second must not error and must not change anything. */
  const second = await result(
    workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", completionForm(pdf))
  );
  assert.equal(second.status, 200);
  const secondBody = await second.json();
  assert.equal(secondBody.status, JOB_STATUSES.completed);
  assert.equal(secondBody.mockOutput, false);

  /* The PDF is stored privately and served only through the protected route. */
  assert.ok((await readOutputPdf(job.jobId)).length > 0);
  const served = await download(new Request(`http://local/api/render-jobs/${job.jobId}/download`));
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "application/pdf");
  assert.equal(served.headers.get("cache-control"), "private, no-store");
  assert.match(Buffer.from(await served.arrayBuffer()).subarray(0, 5).toString(), /^%PDF-/);

  /* The customer's CSV is gone the moment it is no longer needed. */
  assert.equal(await readInputCsv(job.jobId), null);
});

test("a completed result must actually be a PDF", async () => {
  const { job } = await submitJob();
  await claimAs("worker-a");

  const notPdf = new FormData();
  notPdf.set("status", "completed");
  notPdf.set("workerId", "worker-a");
  notPdf.set("pdf", new Blob(["<html>error page</html>".padEnd(600, " ")], { type: "application/pdf" }), "x.pdf");
  const rejected = await result(
    workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", notPdf)
  );
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /not a PDF/);

  const tiny = new FormData();
  tiny.set("status", "completed");
  tiny.set("workerId", "worker-a");
  tiny.set("pdf", new Blob(["%PDF-"], { type: "application/pdf" }), "x.pdf");
  assert.equal(
    (await result(workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", tiny))).status,
    400
  );

  /* The job is still claimed and still recoverable — a rejected upload must not
     quietly close it. */
  assert.equal((await readJob(job.jobId)).status, JOB_STATUSES.claimed);
});

test("mock output is recorded so the UI can label it, and is never the default", async () => {
  const { job } = await submitJob();
  await claimAs("worker-a");
  const pdf = await samplePdf();
  await result(
    workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", completionForm(pdf, "worker-a", true))
  );
  const finished = await (await status(new Request(`http://local/api/render-jobs/${job.jobId}`))).json();
  assert.equal(finished.mockOutput, true, "a mock render must be flagged");
});

/* ── Failure and retry ── */

test("a failed render is retried, then reported with a bounded message", async () => {
  const { job } = await submitJob();

  const failWith = async (workerId, message) => {
    const form = new FormData();
    form.set("status", "failed");
    form.set("workerId", workerId);
    form.set("errorMessage", message);
    return result(workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", form));
  };

  await claimAs("worker-a");
  await failWith("worker-a", "Missing font");
  /* Attempts remain, so it goes back on the queue rather than failing. */
  assert.equal((await readJob(job.jobId)).status, JOB_STATUSES.queued);

  await claimAs("worker-b");
  await failWith("worker-b", "Missing font");
  assert.equal((await readJob(job.jobId)).status, JOB_STATUSES.queued);

  await claimAs("worker-c");
  await failWith("worker-c", "Missing font");

  const failed = await (await status(new Request(`http://local/api/render-jobs/${job.jobId}`))).json();
  assert.equal(failed.status, JOB_STATUSES.failed);
  assert.equal(failed.stage, "failed");
  assert.equal(failed.errorMessage, "Missing font");
  assert.equal(failed.downloadUrl, null);
  assert.equal((await download(new Request(`http://local/api/render-jobs/${job.jobId}/download`))).status, 409);
});

test("a failure message from the worker is truncated, not echoed unbounded", async () => {
  const { job } = await submitJob();
  await claimAs("worker-a");
  const form = new FormData();
  form.set("status", "failed");
  form.set("workerId", "worker-a");
  form.set("errorMessage", "x".repeat(5000));
  await result(workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", form));
  assert.ok((await readJob(job.jobId)).errorMessage.length <= 300);
});

test("a worker cannot finish a job it does not hold", async () => {
  const { job } = await submitJob();
  await claimAs("worker-a");
  const pdf = await samplePdf();
  const response = await result(
    workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", completionForm(pdf, "worker-b"))
  );
  assert.equal(response.status, 409);
  assert.equal((await readJob(job.jobId)).status, JOB_STATUSES.claimed);
});

/* ── Unknown jobs ── */

test("an unknown or malformed job id is a 404, never a 500", async () => {
  const missing = "a".repeat(64);
  assert.equal((await status(new Request(`http://local/api/render-jobs/${missing}`))).status, 404);
  assert.equal((await download(new Request(`http://local/api/render-jobs/${missing}/download`))).status, 404);
  assert.equal((await status(new Request("http://local/api/render-jobs/not-a-job-id"))).status, 404);
  assert.equal((await download(new Request("http://local/api/render-jobs/not-a-job-id/download"))).status, 404);
});

/* ── Retention ── */

test("cleanup removes the files of a job whose record has expired", async () => {
  const { job } = await submitJob();
  await claimAs("worker-a");
  await result(
    workerRequest(`http://local/api/render-jobs/worker/${job.jobId}/result`, "POST", completionForm(await samplePdf()))
  );
  assert.ok((await readOutputPdf(job.jobId)).length > 0);

  /* Redis expiry removes the record on its own; the blob objects would survive
     it, which is exactly what cleanup exists to prevent. */
  await expireJobRecord(job.jobId);

  const swept = await cleanup(workerRequest("http://local/api/render-jobs/cleanup"));
  assert.equal(swept.status, 200);

  assert.equal(await readOutputPdf(job.jobId), null, "the PDF must be deleted once the job has expired");
  assert.equal(await readInputCsv(job.jobId), null);
  assert.equal((await status(new Request(`http://local/api/render-jobs/${job.jobId}`))).status, 404);
});

test("cleanup is safe to run twice and on an empty store", async () => {
  assert.equal((await cleanup(workerRequest("http://local/api/render-jobs/cleanup"))).status, 200);
  assert.equal((await cleanup(workerRequest("http://local/api/render-jobs/cleanup"))).status, 200);
});
