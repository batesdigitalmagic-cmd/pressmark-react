/*
 * Render-job storage configuration.
 *
 * SERVER ONLY. Never import from src/.
 *
 * This file used to BE the storage: job JSON and customer files written to
 * `.pressmark-render-jobs/` on the local filesystem, with a hard refusal to run
 * anywhere else. That refusal was correct — a Vercel function's filesystem is
 * ephemeral and per-instance, so job state written by one request was invisible
 * to the next — but it left the production flow permanently unable to finish.
 *
 * Storage is now two purpose-built modules:
 *
 *   jobs.js   state, the queue and the leases      Upstash Redis
 *   blob.js   the CSV and the PDF, privately       Vercel Blob
 *
 * What remains here is the question those two cannot answer individually: is
 * this deployment configured to run directory renders at all? Both halves must
 * be present, and a deployment missing either should say which — a 503 reading
 * "not configured for durable storage" told the operator nothing about what to
 * create.
 */

import { blobConfigured } from "./blob.js";
import { jobsConfigured } from "./jobs.js";
import { StorageUnavailableError } from "./storage-errors.js";

export { StorageUnavailableError };

/**
 * What this deployment is missing, if anything.
 *
 * Returned rather than thrown so the health endpoint can report readiness
 * without provoking an error, and so the message can name the exact resource
 * and variable to create.
 *
 * @returns {{ready: boolean, missing: string[], detail: string}}
 */
export function renderStorageStatus() {
  const missing = [];
  if (!jobsConfigured()) missing.push("KV_REST_API_URL + KV_REST_API_TOKEN (Vercel → Storage → Upstash Redis)");
  if (!blobConfigured()) missing.push("BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob)");

  return {
    ready: missing.length === 0,
    missing,
    detail: missing.length === 0 ? "Render storage is configured." : `Not configured: ${missing.join("; ")}.`,
  };
}

/** Throw StorageUnavailableError unless both halves are configured. */
export function assertRenderStorage() {
  const status = renderStorageStatus();
  if (!status.ready) {
    throw new StorageUnavailableError(
      `Directory rendering is not configured on this deployment. Missing: ${status.missing.join("; ")}.`
    );
  }
}
