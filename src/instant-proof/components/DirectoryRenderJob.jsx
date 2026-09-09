/*
 * The production render job: submit, poll, download.
 *
 * ── What this is NOT ──
 *
 * This is not the free proof. The free proof is rendered in the browser and is
 * already on screen above this component. This queues the same directory for
 * the InDesign production pipeline, which needs a Mac running InDesign to have
 * claimed the job. It is offered, never promised.
 *
 * ── Polling ──
 *
 * The interval widens the longer a job runs: a directory sitting in the queue
 * waiting for a worker does not need to be asked every two seconds for twenty
 * minutes. Polling stops dead at a terminal state — there is nothing further to
 * learn once a job is completed or failed, and a component left polling a
 * finished job is how a tab left open overnight turns into thousands of
 * requests.
 *
 * ── One submission per file ──
 *
 * The in-flight promise is cached against the File object itself, so a
 * re-render, a StrictMode double-effect, or a parent state change cannot post
 * the same directory twice. A second POST would not merely waste a render — it
 * would consume one of the customer's five hourly submissions.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* File -> Promise<job>. WeakMap so a discarded File does not pin its response. */
const submissions = new WeakMap();

const TERMINAL = new Set(["completed", "failed"]);

/* Start responsive, end patient. A render takes minutes, not seconds. */
const FIRST_POLL_MS = 1500;
const MAX_POLL_MS = 15000;
const BACKOFF = 1.4;

/* Stop eventually rather than polling a stuck job for ever. */
const MAX_POLL_MS_TOTAL = 30 * 60 * 1000;

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || "The render service could not complete the request.");
  }
  return body;
}

function submit(csv, templateId) {
  if (!submissions.has(csv)) {
    const form = new FormData();
    form.set("templateId", templateId);
    form.set("csv", csv, csv.name);
    submissions.set(
      csv,
      fetch("/api/render-jobs", { method: "POST", body: form }).then(responseJson)
    );
  }
  return submissions.get(csv);
}

/* What the customer is told at each stage. The server sends `stage`; these are
   the words for it. */
const STAGE_TEXT = {
  uploading: "Uploading and validating your directory…",
  queued: "Queued for the Pressmark production renderer.",
  rendering: "InDesign is setting your directory.",
  completed: "Your directory PDF is ready.",
  failed: "",
};

export default function DirectoryRenderJob({
  csv,
  templateId,
  initialJobId,
  onJobId,
  onStartOver,
  showSteps = false,
}) {
  const [job, setJob] = useState(
    initialJobId ? { jobId: initialJobId, status: "queued", stage: "queued" } : null
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(!initialJobId);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* ── Submit once ── */
  useEffect(() => {
    if (initialJobId || !csv) return;
    let cancelled = false;
    submit(csv, templateId)
      .then((created) => {
        if (cancelled || !mounted.current) return;
        setJob(created);
        setSubmitting(false);
        onJobId?.(created.jobId);
      })
      .catch((failure) => {
        if (cancelled || !mounted.current) return;
        setError(failure.message);
        setSubmitting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [csv, initialJobId, onJobId, templateId]);

  /* ── Poll with backoff until terminal ── */
  const jobId = job?.jobId || initialJobId;
  const status = job?.status;

  useEffect(() => {
    if (!jobId || TERMINAL.has(status)) return undefined;

    let cancelled = false;
    let timer;
    let delay = FIRST_POLL_MS;
    const deadline = Date.now() + MAX_POLL_MS_TOTAL;

    const poll = async () => {
      try {
        const latest = await fetch(`/api/render-jobs/${jobId}`, { cache: "no-store" }).then(
          responseJson
        );
        if (cancelled) return;
        setJob(latest);
        /* Terminal: stop. Nothing else will change. */
        if (TERMINAL.has(latest.status)) return;
        if (Date.now() > deadline) {
          setError("This render is taking much longer than expected. Your job id is saved in this page's address — reload later to check on it.");
          return;
        }
        delay = Math.min(Math.round(delay * BACKOFF), MAX_POLL_MS);
        timer = setTimeout(poll, delay);
      } catch (failure) {
        if (cancelled) return;
        /*
         * A poll failure is not a job failure — the network may simply have
         * blinked. Keep polling on the widened interval and surface the message
         * without discarding the job.
         */
        setError(failure.message);
        if (Date.now() > deadline) return;
        delay = Math.min(Math.round(delay * BACKOFF), MAX_POLL_MS);
        timer = setTimeout(poll, delay);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, status]);

  const retry = useCallback(() => {
    setError("");
    setJob((current) => (current ? { ...current } : current));
  }, []);

  const stage = submitting ? "uploading" : job?.stage || "queued";
  const completed = job?.status === "completed";
  const failed = job?.status === "failed";
  const active = completed ? 3 : job || submitting ? 2 : 1;

  return (
    <section aria-live="polite" aria-busy={submitting || (Boolean(job) && !completed && !failed)}>
      {showSteps && (
        <ol style={{ display: "grid", gap: "0.75rem", padding: 0, margin: "0 0 2rem", listStyle: "none" }}>
          {["Choose Directory Classic", "Upload Spreadsheet", "Generate and download proof"].map(
            (label, index) => (
              <li key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span className="ip-step-dot" aria-hidden="true">
                  {index < active ? "✓" : index + 1}
                </span>
                <strong>{label}</strong>
              </li>
            )
          )}
        </ol>
      )}

      {!failed && STAGE_TEXT[stage] && <p className="ip-note">{STAGE_TEXT[stage]}</p>}

      {/* The worker's own words for what it is doing, when it has sent any. */}
      {!failed && !completed && job?.progressMessage && stage === "rendering" && (
        <p className="ip-note ip-muted">{job.progressMessage}</p>
      )}

      {failed && (
        <p role="alert" className="ip-error">
          {job.errorMessage || "The directory could not be generated."}
        </p>
      )}

      {error && !failed && (
        <p role="alert" className="ip-error">
          {error}{" "}
          <button type="button" className="ip-btn-ghost" onClick={retry}>
            Try again
          </button>
        </p>
      )}

      {job?.rowCount > 0 && (
        <p className="ip-note ip-muted">
          {job.rowCount} sorted record{job.rowCount === 1 ? "" : "s"}
        </p>
      )}

      {completed && (
        <div className="ip-section-tight">
          {/*
            * A local mock render is labelled as one, every time. It is not an
            * InDesign render and must never be presented as the customer's
            * production PDF.
            */}
          {job.mockOutput && (
            <p className="ip-notice">
              <strong>Sample output:</strong> this file is the Pressmark sample preview, not an
              InDesign render of your directory.
            </p>
          )}
          <a className="ip-btn-primary ip-touch" href={job.downloadUrl}>
            Download directory PDF
          </a>
        </div>
      )}

      {onStartOver && (
        <p>
          <button type="button" className="ip-btn-ghost ip-touch" onClick={onStartOver}>
            Start over
          </button>
        </p>
      )}
    </section>
  );
}
