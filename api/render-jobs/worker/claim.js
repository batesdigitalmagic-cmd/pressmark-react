import { workerAuthorized } from "../../../lib/render-jobs/auth.js";
import { apiError, json } from "../../../lib/render-jobs/http.js";
import { getRenderJobStorage } from "../../../lib/render-jobs/storage.js";

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!workerAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  try {
    const job = await getRenderJobStorage().claim();
    return job ? json({
      jobId: job.jobId,
      templateId: job.templateId,
      originalFilename: job.originalFilename,
      status: job.status,
      rowCount: job.rowCount,
      inputUrl: `/api/render-jobs/worker/${job.jobId}/input`,
    }) : new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
