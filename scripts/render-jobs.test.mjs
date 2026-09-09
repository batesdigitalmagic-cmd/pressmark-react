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
import result from "../api/render-jobs/worker/[jobId]/result.js";
import { validateAndNormalizeCsv } from "../lib/render-jobs/csv.js";
import { templateFor } from "../src/instant-proof/templates/registry.js";

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
  assert.match(pageSource, /const usesDirectoryQueue = Boolean\(renderJobId\) \|\| inputMode === "csv"/);
  assert.doesNotMatch(uploadSource, /templateId === "directory-classic"/);
  assert.match(createSource, /inputMode !== "csv"/);
});

function workerRequest(url, method = "POST", body) {
  return new Request(url, { method, headers: { Authorization: `Bearer ${token}` }, body });
}

test("complete API flow enforces worker auth and download state", async () => {
  const form = new FormData();
  form.set("templateId", "directory-classic");
  form.set("csv", new Blob(["last_name,first_name\nZulu,Amy\nAlpha,Ben\n"], { type: "text/csv" }), "../../members.csv");
  const createdResponse = await submit(new Request("http://local/api/render-jobs", { method: "POST", body: form }));
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.match(created.jobId, /^[a-f0-9]{64}$/);
  assert.equal(created.originalFilename, "members.csv");
  assert.equal(created.status, "queued");
  assert.equal(created.rowCount, 2);

  assert.equal((await claim(new Request("http://local/api/render-jobs/worker/claim", { method: "POST" }))).status, 401);
  assert.equal((await download(new Request(`http://local/api/render-jobs/${created.jobId}/download`))).status, 409);
  const claimedResponse = await claim(workerRequest("http://local/api/render-jobs/worker/claim"));
  const claimed = await claimedResponse.json();
  assert.equal(claimed.status, "processing");
  const inputResponse = await input(workerRequest(`http://local/api/render-jobs/worker/${created.jobId}/input`, "GET"));
  assert.match(await inputResponse.text(), /^last_name,first_name\r\nAlpha,Ben\r\nZulu,Amy/);

  const resultForm = new FormData();
  resultForm.set("status", "completed");
  resultForm.set("mockOutput", "true");
  const preview = await readFile("public/proof-templates/directory-classic/preview.pdf");
  resultForm.set("pdf", new Blob([preview], { type: "application/pdf" }), "proof.pdf");
  assert.equal((await result(workerRequest(`http://local/api/render-jobs/worker/${created.jobId}/result`, "POST", resultForm))).status, 200);
  const final = await (await status(new Request(`http://local/api/render-jobs/${created.jobId}`))).json();
  assert.equal(final.status, "completed");
  assert.equal(final.mockOutput, true);
  const pdf = await download(new Request(`http://local/api/render-jobs/${created.jobId}/download`));
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), /^%PDF-/);
});

test("worker can mark a claimed job failed with a sanitized bounded message", async () => {
  const form = new FormData();
  form.set("templateId", "directory-classic");
  form.set("csv", new Blob(["last_name,first_name\nSmith,Amy\n"], { type: "text/csv" }), "members.csv");
  const created = await (await submit(new Request("http://local/api/render-jobs", { method: "POST", body: form }))).json();
  await claim(workerRequest("http://local/api/render-jobs/worker/claim"));
  const failure = new FormData(); failure.set("status", "failed"); failure.set("errorMessage", "Missing font");
  await result(workerRequest(`http://local/api/render-jobs/worker/${created.jobId}/result`, "POST", failure));
  const failed = await (await status(new Request(`http://local/api/render-jobs/${created.jobId}`))).json();
  assert.equal(failed.status, "failed"); assert.equal(failed.errorMessage, "Missing font");
});
