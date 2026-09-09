/*
 * GET /api/render-jobs/:jobId/download — stream the finished PDF.
 *
 * ── Why this streams rather than redirecting ──
 *
 * The PDF lives in private blob storage. We could mint a signed URL and send
 * the browser there, but that hands out a second capability with its own
 * lifetime that we cannot withdraw when the job expires. Streaming keeps the
 * blob token server-side and makes access exactly as long-lived as this
 * request. The blob URL is never in a response body, a header, or a log.
 *
 * The 256-bit job id is the customer's bearer capability. There is no session
 * here by design: the proof flow asks for no account and no email.
 */

import { apiError, jobIdFrom, json } from "../../../lib/render-jobs/http.js";
import { readJob, JOB_STATUSES } from "../../../lib/render-jobs/jobs.js";
import { readOutputPdf } from "../../../lib/render-jobs/blob.js";
import { assertRenderStorage } from "../../../lib/render-jobs/storage.js";
import { clientIp, rateLimit, tooManyRequests } from "../../../lib/rate-limit.js";
import { toNodeHandler } from "../../../lib/render-jobs/node-adapter.js";

async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  /* Generous, but it stops a leaked id being used to hammer blob storage. */
  const limited = await rateLimit("directory-render-download", clientIp(request), {
    limit: 60,
    windowSeconds: 3600,
  });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);

  try {
    assertRenderStorage();
    const jobId = jobIdFrom(request, "/download");
    const job = await readJob(jobId);
    if (!job) return json({ error: "Render job not found." }, 404);

    /* Only a completed job has a PDF. A queued or failed one is a 409, not a
       404: the job is real, it just has nothing to give yet. */
    if (job.status !== JOB_STATUSES.completed) {
      return json({ error: "The PDF is not ready." }, 409);
    }

    const bytes = await readOutputPdf(jobId);
    if (!bytes) return json({ error: "The completed PDF is no longer available." }, 404);

    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="church-directory-classic-proof.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (/Invalid job ID/.test(error?.message || "")) {
      return json({ error: "Render job not found." }, 404);
    }
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
