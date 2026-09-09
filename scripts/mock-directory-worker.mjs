import { readFile } from "node:fs/promises";
import path from "node:path";

const token = (process.env.PRESSMARK_WORKER_TOKEN || "").trim();
const baseUrl = (process.env.PRESSMARK_RENDER_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
if (!token) throw new Error("PRESSMARK_WORKER_TOKEN is required.");
const authorization = { Authorization: `Bearer ${token}` };
/* The claim now identifies the worker, so ownership can be proved on the
   completion call. The mock names itself plainly — it must never look like the
   production Mac worker in a job record. */
const workerId = "local-mock-worker";
const claim = await fetch(`${baseUrl}/api/render-jobs/worker/claim`, {
  method: "POST",
  headers: { ...authorization, "Content-Type": "application/json" },
  body: JSON.stringify({ workerId }),
});
if (claim.status === 204) { console.log("No queued directory jobs."); process.exit(0); }
if (!claim.ok) throw new Error(`Claim failed (${claim.status}).`);
const job = await claim.json();
const input = await fetch(`${baseUrl}${job.inputUrl}`, { headers: authorization });
if (!input.ok) throw new Error(`Input download failed (${input.status}).`);
await input.arrayBuffer();
const preview = await readFile(path.resolve("public/proof-templates/directory-classic/preview.pdf"));
const form = new FormData();
form.set("status", "completed");
form.set("workerId", workerId);
form.set("mockOutput", "true");
form.set("pdf", new Blob([preview], { type: "application/pdf" }), "church-directory-classic-proof.pdf");
const result = await fetch(`${baseUrl}/api/render-jobs/worker/${job.jobId}/result`, { method: "POST", headers: authorization, body: form });
if (!result.ok) throw new Error(`Completion failed (${result.status}).`);
console.log(`Completed ${job.jobId} with the local sample PDF (not an InDesign render).`);
