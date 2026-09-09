import { apiError, jobIdFrom, json, publicJob } from "../../lib/render-jobs/http.js";
import { getRenderJobStorage } from "../../lib/render-jobs/storage.js";

export default async function handler(request) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  try {
    const job = await getRenderJobStorage().get(jobIdFrom(request));
    return job ? json(publicJob(job)) : json({ error: "Render job not found." }, 404);
  } catch (error) { return apiError(error); }
}
