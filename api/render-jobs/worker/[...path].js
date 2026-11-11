/*
 * One Vercel function for every Mac-worker endpoint:
 *
 *   POST /api/render-jobs/worker/claim
 *   GET  /api/render-jobs/worker/status
 *   POST /api/render-jobs/worker/:jobId/heartbeat
 *   GET  /api/render-jobs/worker/:jobId/input
 *   POST /api/render-jobs/worker/:jobId/result
 *
 * ── Why one file ──
 *
 * Vercel's Hobby plan allows 12 Node serverless functions per deployment, and
 * each file under api/ counts as one (Edge functions are exempt). The project
 * was exactly at 12, so adding the customer platform was the 13th and failed the
 * deploy. These five were five files with no shared reason to be separate.
 *
 * ── Nothing about the contract changed ──
 *
 * The URLs, methods, bearer-token check and responses are exactly what they
 * were: this file only picks the handler by path. It is a catch-all route, not a
 * rewrite, so each handler still sees the original request URL and parses the
 * job id from it as before. The handlers moved to lib/render-jobs/worker-routes/
 * unchanged apart from their import paths.
 *
 * Authorization stays inside each handler (checked before the method, as their
 * comments explain). An unknown path under /worker/ is answered here with a bare
 * 404 and no information; it never reaches a handler.
 */

import claim from "../../../lib/render-jobs/worker-routes/claim.js";
import status from "../../../lib/render-jobs/worker-routes/status.js";
import heartbeat from "../../../lib/render-jobs/worker-routes/heartbeat.js";
import input from "../../../lib/render-jobs/worker-routes/input.js";
import result from "../../../lib/render-jobs/worker-routes/result.js";

/* [pattern for the path after /api/render-jobs/worker/, handler]. The job id is
   deliberately matched loosely: each handler validates it and answers an invalid
   one exactly as before. */
const ROUTES = [
  [/^claim$/, claim],
  [/^status$/, status],
  [/^[^/]+\/heartbeat$/, heartbeat],
  [/^[^/]+\/input$/, input],
  [/^[^/]+\/result$/, result],
];

const isWebRequest = (value) => typeof Request !== "undefined" && value instanceof Request;

export function workerRouteFor(url) {
  const path = new URL(url, "http://local").pathname
    .replace(/^\/api\/render-jobs\/worker\/?/, "")
    .replace(/\/$/, "");
  return ROUTES.find(([pattern]) => pattern.test(path))?.[1] ?? null;
}

const NOT_FOUND = JSON.stringify({ error: "Not found" });

export default async function handler(requestOrNodeRequest, nodeResponse) {
  /* Web-style call (tests): return a Response. */
  if (nodeResponse === undefined && isWebRequest(requestOrNodeRequest)) {
    const target = workerRouteFor(requestOrNodeRequest.url);
    return target
      ? target(requestOrNodeRequest)
      : new Response(NOT_FOUND, { status: 404, headers: { "Content-Type": "application/json" } });
  }

  /* Node-style call: how Vercel's runtime invokes it. */
  const target = workerRouteFor(requestOrNodeRequest.url || "");
  if (!target) {
    nodeResponse.writeHead(404, { "Content-Type": "application/json" });
    nodeResponse.end(NOT_FOUND);
    return undefined;
  }
  return target(requestOrNodeRequest, nodeResponse);
}
