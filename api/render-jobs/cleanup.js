/*
 * POST /api/render-jobs/cleanup — retention and lease recovery.
 *
 * Worker-token protected. Safe to run repeatedly and concurrently; deleting
 * what is already gone is not an error.
 *
 * ── Why this endpoint has to exist ──
 *
 * Redis expires job metadata on its own after RETENTION_SECONDS. Vercel Blob
 * has no TTL, so the CSV and the PDF would outlive the record that pointed at
 * them and become undeletable — nothing would remember they existed. Retention
 * is only real if something walks the objects and removes them.
 *
 * Two passes:
 *
 *   1. Recover leases whose worker died, so a crashed Mac does not leave a
 *      customer waiting for ever. Same sweep `claim` runs, exposed separately so
 *      it still happens when no worker is polling at all.
 *   2. Delete the objects of every job past its expiry, found through
 *      `expiredJobIds()`.
 *
 * The second pass reads the retention INDEX, not the active set. A completed
 * job leaves the active set immediately, and a completed job is precisely the
 * one still holding a PDF — sweeping the active set would therefore have
 * collected nothing that mattered.
 *
 * Drive it from a Vercel Cron (see docs/indesign-render-pipeline.md). The worker
 * also calls it opportunistically while idle, so a deployment without a cron
 * still expires data as long as the Mac is running.
 */

import { workerAuthorized } from "../../lib/render-jobs/auth.js";
import { apiError, json } from "../../lib/render-jobs/http.js";
import {
  deleteJob,
  expiredJobIds,
  readJob,
  recoverExpiredLeases,
  trackedJobCount,
} from "../../lib/render-jobs/jobs.js";
import { deleteJobObjects } from "../../lib/render-jobs/blob.js";
import { assertRenderStorage } from "../../lib/render-jobs/storage.js";
import { toNodeHandler } from "../../lib/render-jobs/node-adapter.js";

/* Bounded so one invocation cannot run past a function timeout on a big
   backlog. The next run picks up where this one stopped. */
const MAX_PER_RUN = 100;

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

    const recovery = await recoverExpiredLeases();

    let purged = 0;
    for (const jobId of await expiredJobIds(MAX_PER_RUN)) {
      /*
       * The record may still exist — Redis expiry is not instantaneous, and a
       * job can be indexed as expired a moment before its key goes. Either way
       * its window has closed, so the files go.
       */
      await deleteJobObjects(jobId).catch(() => undefined);
      await deleteJob(jobId).catch(() => undefined);
      purged += 1;
    }

    /*
     * Ids the caller knows are finished with. The worker passes none today;
     * this exists so an operator can expire a specific job on request without
     * waiting for its window — a customer asking us to delete their data
     * should not be told to wait 48 hours.
     */
    const body = await request.json().catch(() => ({}));
    const requested = Array.isArray(body.expire) ? body.expire.slice(0, MAX_PER_RUN) : [];
    for (const jobId of requested) {
      const job = await readJob(jobId).catch(() => null);
      /* Refuse to delete a job that is still running; its worker would then
         upload into storage nothing is tracking. */
      if (job && (job.status === "claimed" || job.status === "rendering")) continue;
      await deleteJobObjects(jobId).catch(() => undefined);
      await deleteJob(jobId).catch(() => undefined);
      purged += 1;
    }

    return json({
      recovered: recovery.recovered,
      failed: recovery.failed,
      purged,
      tracked: await trackedJobCount(),
    });
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
