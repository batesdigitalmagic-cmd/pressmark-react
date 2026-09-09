/*
 * Shared HTTP helpers for the render-job endpoints.
 *
 * SERVER ONLY. Never import from src/.
 */

import path from "node:path";
import { StorageUnavailableError } from "./storage-errors.js";
import { JOB_STATUSES } from "./jobs.js";

export const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export function jobIdFrom(request, suffix = "") {
  return new URL(request.url).pathname.replace(suffix, "").split("/").filter(Boolean).at(-1) || "";
}

export const safeOriginalFilename = (value) =>
  path
    .basename(String(value || "upload.csv"))
    .split("")
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join("")
    .slice(0, 180);

/*
 * The stages a customer is shown.
 *
 * `claimed` and `rendering` are separate states internally — one means a worker
 * has taken the job, the other that InDesign is actually running — but both
 * read as "we are making your PDF" to the person waiting, so they collapse into
 * one customer-facing stage rather than flickering between two labels.
 */
export const CUSTOMER_STAGES = {
  [JOB_STATUSES.queued]: "queued",
  [JOB_STATUSES.claimed]: "rendering",
  [JOB_STATUSES.rendering]: "rendering",
  [JOB_STATUSES.completed]: "completed",
  [JOB_STATUSES.failed]: "failed",
};

/**
 * The job as the customer's browser is allowed to see it.
 *
 * Deliberately omits workerId, leaseExpiresAt, heartbeatAt, attempts, the blob
 * paths and every other operational field. Those describe our infrastructure,
 * not their directory, and a job id is a bearer capability — whoever holds the
 * URL sees this, so it must carry nothing we would not hand to a stranger who
 * guessed 256 bits.
 */
export const publicJob = (job) => ({
  jobId: job.jobId,
  templateId: job.templateId,
  originalFilename: job.originalFilename,
  status: job.status,
  stage: CUSTOMER_STAGES[job.status] ?? "queued",
  progress: typeof job.progress === "number" ? job.progress : 0,
  progressMessage: job.progressMessage || "",
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  expiresAt: job.expiresAt,
  errorMessage: job.status === JOB_STATUSES.failed ? job.errorMessage || "" : "",
  rowCount: job.rowCount,
  mockOutput: Boolean(job.mockOutput),
  downloadUrl: job.status === JOB_STATUSES.completed ? `/api/render-jobs/${job.jobId}/download` : null,
});

/**
 * The job as the worker is allowed to see it.
 *
 * The worker is trusted with operational fields — it needs its own lease
 * deadline to know when to give up — but never with a blob URL or a token.
 */
export const workerJob = (job) => ({
  jobId: job.jobId,
  templateId: job.templateId,
  originalFilename: job.originalFilename,
  status: job.status,
  rowCount: job.rowCount,
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  workerId: job.workerId,
  leaseExpiresAt: job.leaseExpiresAt,
  inputUrl: `/api/render-jobs/worker/${job.jobId}/input`,
  heartbeatUrl: `/api/render-jobs/worker/${job.jobId}/heartbeat`,
  resultUrl: `/api/render-jobs/worker/${job.jobId}/result`,
});

export function apiError(error) {
  if (error instanceof StorageUnavailableError) return json({ error: error.message }, 503);
  /* Never the stack, never the message — an upstream error can carry a URL or a
     key fragment, and this line goes to a shared log. */
  console.error("[render-jobs]", error?.message || "Unexpected error");
  return json({ error: "The render job request could not be completed." }, 500);
}
