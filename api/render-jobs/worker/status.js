/*
 * GET /api/render-jobs/worker/status — how much work is waiting.
 *
 * Worker-token protected. Read-only: it counts, it never claims. Calling the
 * claim endpoint to find out whether anything is queued would hand a real
 * customer's job to whoever was only asking a question.
 *
 * ── Counts only, deliberately ──
 *
 * The response carries three numbers and nothing else. No job ids, no
 * filenames, no customer content — an operator watching a worker's log or a
 * monitoring probe hitting this endpoint has no business learning who uploaded
 * what. `scripts/render-queue-status.mjs` is the richer view, and it is run
 * deliberately by a person with store credentials rather than emitted into a
 * log every minute.
 */

import { workerAuthorized } from "../../../lib/render-jobs/auth.js";
import { apiError, json } from "../../../lib/render-jobs/http.js";
import { activeJobIds, queueDepth, trackedJobCount } from "../../../lib/render-jobs/jobs.js";
import { assertRenderStorage } from "../../../lib/render-jobs/storage.js";
import { toNodeHandler } from "../../../lib/render-jobs/node-adapter.js";

async function handler(request) {
  if (!workerAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    assertRenderStorage();
    const [queued, active, tracked] = await Promise.all([
      queueDepth(),
      activeJobIds(),
      trackedJobCount(),
    ]);
    return json({ queued, active: active.length, tracked });
  } catch (error) {
    return apiError(error);
  }
}

/* See lib/render-jobs/node-adapter.js — Vercel's Node runtime calls handlers as
   (req, res), not with a Web Request. */
export default toNodeHandler(handler);
