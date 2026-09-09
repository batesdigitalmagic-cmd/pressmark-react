/*
 * POST /api/render-jobs/worker/claim — hand one queued job to one worker.
 *
 * Worker-token protected. The atomicity that matters lives in
 * jobs.js#claimNextJob: the lease is taken with SET NX, so of two workers
 * racing for the same job exactly one is served and the other is told 204.
 *
 * Also runs the expired-lease sweep, so a job stranded by a Mac that crashed
 * mid-render is offered again rather than sitting in `active` for ever.
 */

import { workerAuthorized } from "../../../lib/render-jobs/auth.js";
import { apiError, json, workerJob } from "../../../lib/render-jobs/http.js";
import { claimNextJob } from "../../../lib/render-jobs/jobs.js";
import { assertRenderStorage } from "../../../lib/render-jobs/storage.js";
import { toNodeHandler } from "../../../lib/render-jobs/node-adapter.js";

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

    /* The worker identifies itself so ownership can be proved on every later
       write. An anonymous claim could not be distinguished from a stale one. */
    const body = await request.json().catch(() => ({}));
    const workerId = String(body.workerId || "").trim().slice(0, 100);
    if (!workerId) return json({ error: "A workerId is required." }, 400);

    const job = await claimNextJob(workerId);
    /* 204 rather than an error: an empty queue is the normal state of a
       healthy system, and the worker polls on it. */
    return job ? json(workerJob(job)) : new Response(null, { status: 204 });
  } catch (error) {
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
