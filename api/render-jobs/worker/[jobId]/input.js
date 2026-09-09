/*
 * GET /api/render-jobs/worker/:jobId/input — the normalized CSV.
 *
 * Worker-token protected, and streamed from private blob storage rather than
 * redirecting: the blob token never leaves the server.
 */

import { workerAuthorized } from "../../../../lib/render-jobs/auth.js";
import { apiError, jobIdFrom, json } from "../../../../lib/render-jobs/http.js";
import { readJob, JOB_STATUSES } from "../../../../lib/render-jobs/jobs.js";
import { readInputCsv } from "../../../../lib/render-jobs/blob.js";
import { assertRenderStorage } from "../../../../lib/render-jobs/storage.js";

/* Only a job someone is actively holding has an input worth serving. */
const HELD = new Set([JOB_STATUSES.claimed, JOB_STATUSES.rendering]);

export default async function handler(request) {
  /*
   * Authorization is checked BEFORE the method.
   *
   * The other way round, an unauthenticated request with the wrong method got a
   * 405 without the token ever being examined — which made a GET probe answer
   * "method not allowed" for a valid token and an invalid one alike. The
   * worker's own health check used exactly such a probe and would therefore
   * report a bad token as authorized. It also told an anonymous caller which
   * methods an endpoint implements, which they have no business learning.
   */
  if (!workerAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    assertRenderStorage();
    const jobId = jobIdFrom(request, "/input");
    const job = await readJob(jobId);
    if (!job || !HELD.has(job.status)) return json({ error: "Claimed job not found." }, 404);

    const bytes = await readInputCsv(jobId);
    if (!bytes) return json({ error: "The input CSV is no longer available." }, 404);

    return new Response(bytes, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (/Invalid job ID/.test(error?.message || "")) return json({ error: "Claimed job not found." }, 404);
    return apiError(error);
  }
}
