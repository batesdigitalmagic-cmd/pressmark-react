/*
 * GET /api/render-jobs/:jobId — the customer's view of one job.
 *
 * The job id is the capability: whoever holds it sees this. `publicJob` is
 * therefore deliberately narrow — no worker id, no lease, no blob path.
 *
 * Polled by the browser, so it must stay cheap and must never cache.
 */

import { apiError, jobIdFrom, json, publicJob } from "../../lib/render-jobs/http.js";
import { readJob } from "../../lib/render-jobs/jobs.js";
import { assertRenderStorage } from "../../lib/render-jobs/storage.js";

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    assertRenderStorage();
    const job = await readJob(jobIdFrom(request));
    /* Expired and never-existed are deliberately the same answer: confirming
       that an id was once real would leak that a directory was rendered. */
    return job ? json(publicJob(job)) : json({ error: "Render job not found." }, 404);
  } catch (error) {
    if (/Invalid job ID/.test(error?.message || "")) {
      return json({ error: "Render job not found." }, 404);
    }
    return apiError(error);
  }
}
