import { workerAuthorized } from "../../../../lib/render-jobs/auth.js";
import { apiError, jobIdFrom, json } from "../../../../lib/render-jobs/http.js";
import { getRenderJobStorage } from "../../../../lib/render-jobs/storage.js";

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!workerAuthorized(request)) return json({ error: "Unauthorized" }, 401);
  try {
    const storage = getRenderJobStorage(), jobId = jobIdFrom(request, "/result"), job = await storage.get(jobId);
    if (!job || job.status !== "processing") return json({ error: "Processing job not found." }, 404);
    const form = await request.formData(), status = String(form.get("status") || "");
    if (status === "failed") {
      const errorMessage = String(form.get("errorMessage") || "InDesign could not render this directory.").slice(0, 500);
      return json(await storage.update(jobId, { status: "failed", errorMessage }));
    }
    const pdf = form.get("pdf");
    if (status !== "completed" || !(pdf instanceof File) || pdf.type !== "application/pdf") return json({ error: "A completed result requires one PDF file." }, 400);
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return json({ error: "The uploaded result is not a PDF." }, 400);
    await storage.putOutput(jobId, bytes);
    return json(await storage.update(jobId, { status: "completed", errorMessage: "", mockOutput: String(form.get("mockOutput") || "") === "true" }));
  } catch (error) { return apiError(error); }
}
