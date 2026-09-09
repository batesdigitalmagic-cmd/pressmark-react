import { randomBytes } from "node:crypto";
import { clientIp, rateLimit, tooManyRequests } from "../../lib/rate-limit.js";
import { validateAndNormalizeCsv } from "../../lib/render-jobs/csv.js";
import { apiError, json, publicJob, safeOriginalFilename } from "../../lib/render-jobs/http.js";
import { getRenderJobStorage } from "../../lib/render-jobs/storage.js";

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const limited = await rateLimit("directory-render-submit", clientIp(request), { limit: 5, windowSeconds: 3600 });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);
  try {
    const form = await request.formData();
    const upload = form.get("csv");
    const templateId = String(form.get("templateId") || "");
    if (templateId !== "directory-classic") return json({ error: "Only Directory Classic is supported." }, 400);
    if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".csv")) return json({ error: "Upload one .csv file." }, 400);
    const maximum = Number(process.env.PRESSMARK_RENDER_MAX_CSV_BYTES) || 2 * 1024 * 1024;
    if (upload.size <= 0 || upload.size > maximum) return json({ error: `CSV files must be no larger than ${maximum} bytes.` }, 413);
    let normalized;
    try { normalized = validateAndNormalizeCsv(new Uint8Array(await upload.arrayBuffer())); }
    catch (error) { return json({ error: error.message }, 400); }
    const jobId = randomBytes(32).toString("hex");
    const now = new Date().toISOString();
    const job = {
      jobId, templateId, originalFilename: safeOriginalFilename(upload.name),
      inputCsvKey: `render-jobs/${jobId}/input.csv`, outputPdfKey: `render-jobs/${jobId}/output.pdf`,
      status: "uploaded", createdAt: now, updatedAt: now, errorMessage: "",
      rowCount: normalized.rowCount, mockOutput: false,
    };
    const storage = getRenderJobStorage();
    await storage.create(job, normalized.bytes);
    const queued = await storage.update(jobId, { status: "queued" });
    return json(publicJob(queued), 201);
  } catch (error) { return apiError(error); }
}
