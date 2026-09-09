import { apiError, jobIdFrom, json } from "../../../lib/render-jobs/http.js";
import { getRenderJobStorage } from "../../../lib/render-jobs/storage.js";

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    const storage = getRenderJobStorage(), jobId = jobIdFrom(request, "/download");
    const job = await storage.get(jobId);
    if (!job) return json({ error: "Render job not found." }, 404);
    if (job.status !== "completed") return json({ error: "The PDF is not ready." }, 409);
    const output = await storage.output(jobId);
    if (!output) return json({ error: "The completed PDF is unavailable." }, 404);
    return new Response(output, { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="church-directory-classic-proof.pdf"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return apiError(error); }
}
