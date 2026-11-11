/*
 * The worker's client for the render-job API.
 *
 * Every call carries the worker bearer token. The token is set here in one
 * place so no call site can forget it, and it is never logged: errors quote the
 * status and the server's message, never the request.
 */

import { log } from "./log.mjs";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* Vercel refuses a request body over 4.5 MB before the function runs. Stay under
   it with room for multipart framing; anything larger goes straight to Blob. */
export const DIRECT_UPLOAD_MIN_BYTES = 4 * 1024 * 1024;

export function createApi(config, { blobPut } = {}) {
  const url = (suffix) => `${config.apiUrl}${suffix}`;
  const auth = () => ({ Authorization: `Bearer ${config.token}` });

  async function readError(response) {
    const body = await response.json().catch(() => ({}));
    return new ApiError(response.status, body.error || `HTTP ${response.status}`);
  }

  return {
    /**
     * Ask for a job. Resolves null when the queue is empty (204), which is the
     * normal state of a healthy system rather than a condition to log about.
     */
    async claim() {
      const response = await fetch(url("/api/render-jobs/worker/claim"), {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: config.workerId }),
        cache: "no-store",
      });
      if (response.status === 204) return null;
      if (!response.ok) throw await readError(response);
      return response.json();
    },

    /** The normalized CSV, as bytes. Never logged, never written outside the job dir. */
    async downloadInput(jobId) {
      const response = await fetch(url(`/api/render-jobs/worker/${jobId}/input`), {
        headers: auth(),
        cache: "no-store",
      });
      if (!response.ok) throw await readError(response);
      return Buffer.from(await response.arrayBuffer());
    },

    /**
     * Renew the lease and report progress.
     *
     * A 409 means the lease is gone and the job belongs to someone else now.
     * Returns false so the caller can abandon rather than finish work that will
     * be rejected — or worse, accepted twice.
     */
    async heartbeat(jobId, { progress, progressMessage, rendering } = {}) {
      const response = await fetch(url(`/api/render-jobs/worker/${jobId}/heartbeat`), {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: config.workerId, progress, progressMessage, rendering }),
        cache: "no-store",
      });
      if (response.status === 409) return false;
      if (!response.ok) throw await readError(response);
      return true;
    },

    /**
     * Large PDFs: ask the server for a token scoped to this job's output path,
     * upload straight to Blob, then tell the server to verify and finish.
     * Resolves null when direct upload is unavailable (501), so the caller can
     * fall back to the multipart path instead of failing the job.
     */
    async completeDirect(jobId, pdfBytes) {
      const ask = new FormData();
      ask.set("status", "request_upload");
      ask.set("workerId", config.workerId);
      const granted = await fetch(url(`/api/render-jobs/worker/${jobId}/result`), {
        method: "POST", headers: auth(), body: ask,
      });
      if (granted.status === 501) return null;
      if (!granted.ok) throw await readError(granted);
      const { pathname, clientToken } = await granted.json();

      /* Imported on demand: the SDK is only needed for large files, and a missing
         install must surface as a clear error rather than at worker start. */
      const put = blobPut || (await import("@vercel/blob/client")).put;
      await put(pathname, pdfBytes, {
        access: "private",
        token: clientToken,
        contentType: "application/pdf",
        multipart: true,
      });

      const done = new FormData();
      done.set("status", "completed");
      done.set("workerId", config.workerId);
      done.set("uploaded", "true");
      const response = await fetch(url(`/api/render-jobs/worker/${jobId}/result`), {
        method: "POST", headers: auth(), body: done,
      });
      if (!response.ok) throw await readError(response);
      return response.json();
    },

    /** Upload the finished PDF and close the job. Safe to call twice. */
    async complete(jobId, pdfBytes) {
      if (pdfBytes.length > DIRECT_UPLOAD_MIN_BYTES) {
        const direct = await this.completeDirect(jobId, pdfBytes);
        if (direct) return direct;
      }
      const form = new FormData();
      form.set("status", "completed");
      form.set("workerId", config.workerId);
      form.set("pdf", new Blob([pdfBytes], { type: "application/pdf" }), "directory.pdf");
      const response = await fetch(url(`/api/render-jobs/worker/${jobId}/result`), {
        method: "POST",
        headers: auth(),
        body: form,
      });
      if (!response.ok) throw await readError(response);
      return response.json();
    },

    /** Report failure with a message already safe for a customer to read. */
    async fail(jobId, errorMessage) {
      const form = new FormData();
      form.set("status", "failed");
      form.set("workerId", config.workerId);
      form.set("errorMessage", errorMessage);
      const response = await fetch(url(`/api/render-jobs/worker/${jobId}/result`), {
        method: "POST",
        headers: auth(),
        body: form,
      });
      if (!response.ok) throw await readError(response);
      return response.json();
    },

    /**
     * How much work is waiting. Counts only — no ids, no filenames.
     *
     * Read-only: it never claims. Returns null on failure rather than throwing,
     * because not knowing the queue depth must never stop the worker from
     * doing its actual job.
     */
    async status() {
      try {
        const response = await fetch(url("/api/render-jobs/worker/status"), {
          headers: auth(),
          cache: "no-store",
        });
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },

    /**
     * Retention sweep. Opportunistic: a deployment with no cron still expires
     * data as long as this Mac is running, so a failure here is logged and
     * ignored rather than allowed to stop the loop.
     */
    async cleanup() {
      try {
        const response = await fetch(url("/api/render-jobs/cleanup"), {
          method: "POST",
          headers: { ...auth(), "Content-Type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        if (!response.ok) return null;
        return response.json();
      } catch (error) {
        log.warn("Cleanup sweep failed", { reason: error.message });
        return null;
      }
    },
  };
}
