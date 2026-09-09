/*
 * POST /api/render-jobs/worker/:jobId/heartbeat — renew the lease, report progress.
 *
 * Worker-token protected.
 *
 * A 409 here is meaningful and the worker must obey it: it means the lease is
 * no longer ours, because we stalled long enough for the sweep to hand the job
 * to someone else. Continuing to render at that point would end with two
 * workers uploading a PDF for one job. The worker abandons instead.
 */

import { workerAuthorized } from "../../../../lib/render-jobs/auth.js";
import { apiError, jobIdFrom, json, workerJob } from "../../../../lib/render-jobs/http.js";
import { heartbeatJob, JOB_STATUSES } from "../../../../lib/render-jobs/jobs.js";
import { assertRenderStorage } from "../../../../lib/render-jobs/storage.js";
import { toNodeHandler } from "../../../../lib/render-jobs/node-adapter.js";

async function handler(request) {
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
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    assertRenderStorage();
    const jobId = jobIdFrom(request, "/heartbeat");
    const body = await request.json().catch(() => ({}));
    const workerId = String(body.workerId || "").trim();
    if (!workerId) return json({ error: "A workerId is required." }, 400);

    const job = await heartbeatJob(jobId, workerId, {
      progress: typeof body.progress === "number" ? body.progress : undefined,
      progressMessage: body.progressMessage,
      status: body.rendering ? JOB_STATUSES.rendering : undefined,
    });

    if (!job) return json({ error: "This job is no longer yours." }, 409);
    return json(workerJob(job));
  } catch (error) {
    if (/Invalid job ID/.test(error?.message || "")) return json({ error: "Render job not found." }, 404);
    return apiError(error);
  }
}

/*
 * Wrapped for Vercel's Node runtime, which invokes handlers as (req, res)
 * rather than handing them a Web Request. See lib/render-jobs/node-adapter.js —
 * without this every endpoint here died on `request.headers.get is not a
 * function` in production while passing every local test.
 *
 * The wrapper also accepts a Web-style call, so the test suite drives the exact
 * export Vercel invokes rather than a parallel one.
 */
export default toNodeHandler(handler);
