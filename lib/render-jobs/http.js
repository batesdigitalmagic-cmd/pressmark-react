import path from "node:path";
import { StorageUnavailableError } from "./storage.js";

export const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export function jobIdFrom(request, suffix = "") {
  return new URL(request.url).pathname.replace(suffix, "").split("/").filter(Boolean).at(-1) || "";
}
export const safeOriginalFilename = (value) => path.basename(String(value || "upload.csv"))
  .split("").filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
  .join("").slice(0, 180);
export const publicJob = (job) => ({
  jobId: job.jobId, templateId: job.templateId, originalFilename: job.originalFilename,
  status: job.status, createdAt: job.createdAt, updatedAt: job.updatedAt,
  errorMessage: job.errorMessage, rowCount: job.rowCount, mockOutput: Boolean(job.mockOutput),
  downloadUrl: job.status === "completed" ? `/api/render-jobs/${job.jobId}/download` : null,
});
export function apiError(error) {
  if (error instanceof StorageUnavailableError) return json({ error: error.message }, 503);
  console.error("[render-jobs]", error?.message || "Unexpected error");
  return json({ error: "The render job request could not be completed." }, 500);
}
