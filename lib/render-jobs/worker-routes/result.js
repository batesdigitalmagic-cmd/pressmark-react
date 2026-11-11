/*
 * POST /api/render-jobs/worker/:jobId/result — finish a job.
 *
 * Worker-token protected. Two outcomes:
 *
 *   status=completed  multipart, carrying the PDF
 *   status=failed     a bounded reason
 *
 * ── Idempotent by construction ──
 *
 * A worker that uploads successfully and then loses the response will call
 * again. Completing an already-completed job returns the existing record with
 * 200 rather than erroring, so the retry is harmless; the PDF is simply
 * rewritten to the same path. This is the difference between a worker that can
 * safely retry and one that must guess whether its own work landed.
 *
 * ── The upload is verified before it is stored ──
 *
 * A worker is trusted with the token, not with the file. The bytes must begin
 * with %PDF- and be non-trivial in size, because a zero-byte or HTML error page
 * uploaded as "the render" would reach the customer as a broken download that
 * looks like our fault.
 */

import { workerAuthorized } from "../auth.js";
import { apiError, jobIdFrom, json, publicJob } from "../http.js";
import { completeJob, failJob, readJob, JOB_STATUSES } from "../jobs.js";
import { deleteInputCsv, inspectOutputPdf, issueOutputUploadToken, outputPdfPath, putOutputPdf, removeOutputPdf } from "../blob.js";
import { assertRenderStorage } from "../storage.js";
import { toNodeHandler } from "../node-adapter.js";

/* A single merged directory page is comfortably over this; anything smaller is
   not a document. */
const MIN_PDF_BYTES = 400;
const MAX_PDF_BYTES = Number(process.env.PRESSMARK_RENDER_MAX_PDF_BYTES) || 100 * 1024 * 1024;

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
    const jobId = jobIdFrom(request, "/result");
    const existing = await readJob(jobId);
    if (!existing) return json({ error: "Render job not found." }, 404);

    const form = await request.formData();
    const status = String(form.get("status") || "");
    const workerId = String(form.get("workerId") || "").trim();

    /* Already finished: say so and change nothing. The worker's retry, or a
       duplicate delivery, must not reopen a closed job. */
    if (existing.status === JOB_STATUSES.completed || existing.status === JOB_STATUSES.failed) {
      return json(publicJob(existing));
    }

    if (status === "failed") {
      const reason = String(form.get("errorMessage") || "").slice(0, 300);
      const job = await failJob(jobId, workerId, reason || "InDesign could not render this directory.");
      if (!job) return json({ error: "This job is no longer yours." }, 409);
      return json(publicJob(job));
    }

    /*
     * Large PDFs. A request body over 4.5 MB never reaches this function, so a
     * big publication cannot arrive as the multipart `pdf` field below. The
     * worker instead asks for a token scoped to this job's output path, uploads
     * straight to Blob, then calls back with uploaded=true. The multipart path
     * stays as it was, so a worker that has never heard of this keeps working.
     */
    if (status === "request_upload") {
      if (![JOB_STATUSES.claimed, JOB_STATUSES.rendering].includes(existing.status) || existing.workerId !== workerId) {
        return json({ error: "This job is no longer yours." }, 409);
      }
      const issued = await issueOutputUploadToken(jobId, { maximumSizeInBytes: MAX_PDF_BYTES });
      if (!issued) return json({ error: "Direct upload is not available in this storage mode." }, 501);
      return json({
        pathname: outputPdfPath(jobId),
        clientToken: issued.clientToken,
        expiresAt: new Date(issued.validUntil).toISOString(),
        maximumSizeInBytes: MAX_PDF_BYTES,
      });
    }

    if (status !== "completed") {
      return json({ error: "status must be 'completed', 'failed' or 'request_upload'." }, 400);
    }

    if (String(form.get("uploaded") || "") === "true") {
      if (existing.workerId && existing.workerId !== workerId) {
        return json({ error: "This job is no longer yours." }, 409);
      }
      const stored = await inspectOutputPdf(jobId);
      if (!stored) return json({ error: "No uploaded PDF was found for this job." }, 400);
      if (stored.size < MIN_PDF_BYTES || stored.size > MAX_PDF_BYTES || stored.head.subarray(0, 5).toString("latin1") !== "%PDF-") {
        await removeOutputPdf(jobId).catch(() => undefined);
        return json({ error: "The uploaded result is not a plausible PDF." }, 400);
      }
      const job = await completeJob(jobId, workerId, {
        pdfKey: outputPdfPath(jobId),
        mockOutput: String(form.get("mockOutput") || "") === "true",
      });
      if (!job) return json({ error: "This job is no longer yours." }, 409);
      await deleteInputCsv(jobId).catch(() => undefined);
      return json(publicJob(job));
    }

    const pdf = form.get("pdf");
    if (!(pdf instanceof File)) {
      return json({ error: "A completed result requires one PDF file." }, 400);
    }
    if (pdf.size < MIN_PDF_BYTES || pdf.size > MAX_PDF_BYTES) {
      return json({ error: "The uploaded PDF is not a plausible size." }, 400);
    }

    const bytes = new Uint8Array(await pdf.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return json({ error: "The uploaded result is not a PDF." }, 400);
    }

    /*
     * Store the PDF BEFORE marking the job complete.
     *
     * The customer's download endpoint keys off status===completed, so a job
     * marked complete without its file on disk is a 404 the moment they click.
     * This order makes that state unreachable.
     */
    await putOutputPdf(jobId, bytes);

    const job = await completeJob(jobId, workerId, {
      pdfKey: outputPdfPath(jobId),
      /* Set by the mock worker only, and surfaced to the customer as an
         explicit label. A real InDesign render never sets it. */
      mockOutput: String(form.get("mockOutput") || "") === "true",
    });
    if (!job) return json({ error: "This job is no longer yours." }, 409);

    /*
     * The CSV has done its work. Dropping it now means the customer's names,
     * addresses and phone numbers stop existing here the moment the PDF does,
     * rather than lingering for the rest of the retention window.
     */
    await deleteInputCsv(jobId).catch(() => undefined);

    return json(publicJob(job));
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
