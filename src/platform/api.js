/* Thin client for /api/platform. Cookies carry the session; nothing is kept in JS. */

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(method, path, body) {
  const init = { method, credentials: "same-origin", headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(`/api/platform/${path}`, init);
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error || "Something went wrong.");
  return data;
}

export const STATUS_LABEL = {
  draft: "Draft", uploaded: "Data uploaded", queued: "Queued", processing: "Processing",
  proof_ready: "Awaiting approval", revision_requested: "Revision requested", approved: "Approved", completed: "Completed", failed: "Failed",
};

/* What the customer should do next, per stage. */
export function nextAction(project) {
  switch (project.status) {
    case "draft": return "Upload your CSV data.";
    case "uploaded": return "Review your data and settings, then submit for production.";
    case "queued": return project.production?.waitingForWorker
      ? "Waiting for the production worker to connect. Your job is saved and will start automatically."
      : "In the queue — production starts shortly.";
    case "processing": return "Your directory is being typeset. This page updates automatically.";
    case "proof_ready": return "Review the proof below, then approve it or request changes.";
    case "revision_requested": return "Update your data or settings, then resubmit for a new proof.";
    case "approved": return "Approved, but the final PDF failed validation. Contact support — your approval is recorded.";
    case "completed": return "Approved. Your validated final PDF is ready to download.";
    case "failed": return "Production failed. Fix the issue below and resubmit.";
    default: return "";
  }
}
