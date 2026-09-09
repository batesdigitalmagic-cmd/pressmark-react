/*
 * POST /api/render-jobs — accept a directory CSV and queue it for InDesign.
 *
 * Public and rate-limited. The 256-bit job id returned here is the customer's
 * only capability over the job; it is put in the page URL so a refresh resumes,
 * and it is what the download endpoint checks.
 */

import { randomBytes } from "node:crypto";
import { clientIp, rateLimit, tooManyRequests } from "../../lib/rate-limit.js";
import { validateAndNormalizeCsv } from "../../lib/render-jobs/csv.js";
import { apiError, json, publicJob, safeOriginalFilename } from "../../lib/render-jobs/http.js";
import { assertRenderStorage } from "../../lib/render-jobs/storage.js";
import { createJob } from "../../lib/render-jobs/jobs.js";
import { inputCsvPath, outputPdfPath, putInputCsv } from "../../lib/render-jobs/blob.js";

/* Only this template has a production InDesign counterpart. Anything else would
   queue work no worker knows how to run. */
const SUPPORTED_TEMPLATE_IDS = new Set(["directory-classic"]);

/* Bounds. The row cap is what stops one upload monopolising the single-threaded
   Mac worker for an afternoon. */
const MAX_CSV_BYTES = Number(process.env.PRESSMARK_RENDER_MAX_CSV_BYTES) || 2 * 1024 * 1024;
const MAX_ROWS = Number(process.env.PRESSMARK_RENDER_MAX_ROWS) || 5000;

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const limited = await rateLimit("directory-render-submit", clientIp(request), {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);

  try {
    /* Fail before reading the upload if this deployment cannot store it. */
    assertRenderStorage();

    const form = await request.formData();
    const upload = form.get("csv");
    const templateId = String(form.get("templateId") || "");

    if (!SUPPORTED_TEMPLATE_IDS.has(templateId)) {
      return json({ error: "Only Directory Classic is supported." }, 400);
    }
    if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".csv")) {
      return json({ error: "Upload one .csv file." }, 400);
    }
    if (upload.size <= 0 || upload.size > MAX_CSV_BYTES) {
      return json({ error: `CSV files must be no larger than ${MAX_CSV_BYTES} bytes.` }, 413);
    }

    let normalized;
    try {
      normalized = validateAndNormalizeCsv(new Uint8Array(await upload.arrayBuffer()));
    } catch (error) {
      return json({ error: error.message }, 400);
    }
    if (normalized.rowCount > MAX_ROWS) {
      return json(
        { error: `This directory has ${normalized.rowCount} rows; the limit is ${MAX_ROWS}.` },
        413
      );
    }

    const jobId = randomBytes(32).toString("hex");

    /*
     * The CSV is stored BEFORE the job is queued.
     *
     * A worker can only claim what is on the queue, so writing the file first
     * means a job is never offered whose input is missing. The reverse order
     * has a window where a claim succeeds and the input download 404s.
     */
    await putInputCsv(jobId, normalized.bytes);

    const job = await createJob({
      jobId,
      templateId,
      originalFilename: safeOriginalFilename(upload.name),
      rowCount: normalized.rowCount,
      csvKey: inputCsvPath(jobId),
      pdfKey: outputPdfPath(jobId),
      mockOutput: false,
    });

    return json(publicJob(job), 201);
  } catch (error) {
    return apiError(error);
  }
}
