import { workerAuthorized } from "../../../../lib/render-jobs/auth.js";
import { apiError, jobIdFrom, json } from "../../../../lib/render-jobs/http.js";
import { getRenderJobStorage } from "../../../../lib/render-jobs/storage.js";

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  if (!workerAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  try {
    const storage = getRenderJobStorage(), jobId = jobIdFrom(request, "/input"), job = await storage.get(jobId);
    if (!job || job.status !== "processing") return json({ error: "Claimed job not found." }, 404);
    return new Response(await storage.input(jobId), { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
