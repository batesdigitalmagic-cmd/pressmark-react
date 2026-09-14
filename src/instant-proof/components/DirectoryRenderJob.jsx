/*
 * The production render job: submit, poll, download.
 *
 * ── This IS the deliverable ──
 *
 * The page no longer composes a mock-up in the browser first; what the customer
 * downloads is the InDesign PDF this produces. It needs a Mac running InDesign to
 * have claimed the job, so a queued state can legitimately last a while.
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

import PdfPreview from "./PdfPreview.jsx";
import { PROOF_EVENTS, emit } from "../analytics.js";

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

function submit(csv, templateId, colors) {
  if (!submissions.has(csv)) {
    const form = new FormData();
    form.set("templateId", templateId);
    form.set("csv", csv, csv.name);
    /*
     * Whichever swatches the customer changed, as validated hex. The server
     * validates them again — this is a public endpoint and the page is not the
     * only thing that can post to it — and the worker converts them to CMYK.
     * Sending none is the normal case and renders the template's own swatches.
     */
    for (const [key, hex] of Object.entries(colors ?? {})) {
      form.set(key, hex);
    }
    submissions.set(
      csv,
      fetch("/api/render-jobs", { method: "POST", body: form }).then(responseJson)
    );
  }
  return submissions.get(csv);
}

/*
 * The four things that happen, and how far along each one is.
 *
 * The labels are fixed; which of them is current comes from the job's real
 * status, never from a timer. There is no percentage bar because there is no
 * honest number to put in one — the server knows "queued", "rendering" and
 * "completed", and a bar that crept forward while a job sat in a queue would be
 * making something up.
 */
const PHASES = [
  { key: "uploading", label: "Uploading your directory" },
  { key: "queued", label: "Preparing your InDesign layout" },
  { key: "rendering", label: "Creating your PDF" },
  { key: "completed", label: "Your PDF is ready" },
];

/* The honest sentence under the checklist. The server sends `stage`; these are
   the words for it. */
const STAGE_TEXT = {
  uploading: "Uploading and validating your directory…",
  queued: "Queued for the Pressmark production renderer. A directory waits here until a render machine is free.",
  rendering: "InDesign is setting your directory.",
  completed: "Your directory PDF is ready.",
  failed: "",
};

export default function DirectoryRenderJob({
  csv,
  templateId,
  colors,
  initialJobId,
  onJobId,
  onStartOver,
  sample = false,
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
    submit(csv, templateId, colors)
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
    /*
     * `colors` is intentionally absent from the dependency list. The submission
     * is cached against the File and must happen exactly once; re-running this
     * because a parent re-rendered with a new object identity would be a second
     * POST, and a second POST spends one of the customer's five hourly
     * submissions. The colours are read at submission time, which is the only
     * moment they matter.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /*
   * Completed and failed are reported once, and only when this page watched the
   * job get there. A reload of a finished job (?job=… in the address) shows the
   * result again without counting a second render.
   */
  const source = sample ? "sample" : "upload";
  const startedAt = useRef(0);
  const sawRunning = useRef(false);
  const reported = useRef(false);
  useEffect(() => {
    if (!status) return;
    if (!TERMINAL.has(status)) {
      /* Timed from the first moment this page sees the job queued or running. */
      if (!sawRunning.current) startedAt.current = Date.now();
      sawRunning.current = true;
      return;
    }
    if (reported.current || !sawRunning.current) return;
    reported.current = true;
    if (status === "completed") {
      emit(PROOF_EVENTS.renderCompleted, {
        source,
        record_count: job?.rowCount ?? 0,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
      });
    } else {
      emit(PROOF_EVENTS.renderFailed, { source });
    }
  }, [status, source, job?.rowCount]);

  const stage = submitting ? "uploading" : job?.stage || "queued";
  const completed = job?.status === "completed";
  const failed = job?.status === "failed";
  /* Where the job actually is, as an index into PHASES. */
  const reached = completed ? 3 : PHASES.findIndex((phase) => phase.key === stage);

  const working = !completed && !failed;
  /* The bar's one-line label: the current phase in the customer's words. */
  const workingLabel = submitting
    ? PHASES[0].label
    : PHASES[Math.max(reached, 0)]?.label || "Creating your PDF";

  return (
    <section aria-live="polite" aria-busy={submitting || (Boolean(job) && working)}>
      {/*
        * The rendering bar: a turning mark and a sweep that says "still working"
        * for as long as the job is queued or rendering. It deliberately has no
        * percentage and never fills — the server only knows the stage, not how
        * far through it InDesign is, so a bar that crept forward would be
        * inventing progress. It stays pinned under the top of the screen, so a
        * visitor who scrolls while they wait can still see it moving.
        */}
      {working && !error && (
        <div className="ip-rendering" role="status">
          <span className="ip-rendering-mark" aria-hidden="true" />
          <span className="ip-rendering-label">{workingLabel}…</span>
          <span className="ip-rendering-track" aria-hidden="true">
            <span className="ip-rendering-sweep" />
          </span>
        </div>
      )}

      {!failed && (
        <ol className="ip-steps">
          {PHASES.map((phase, index) => (
            <li
              className="ip-step"
              key={phase.key}
              data-state={index < reached ? "done" : index === reached ? "current" : "todo"}
            >
              <span className="ip-step-n" aria-hidden="true">
                {index < reached || (completed && index === reached) ? "✓" : index + 1}
              </span>
              {phase.label}
            </li>
          ))}
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
          <button type="button" className="ip-btn ip-btn-ghost" onClick={retry}>
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
          {/* Seen in the page first, on a phone or a desktop alike; downloading
              is the customer's choice, not the only way to look at it. */}
          <PdfPreview
            url={job.downloadUrl}
            title={sample ? "Sample directory" : "Your directory"}
            onShown={(pages) => emit(PROOF_EVENTS.previewShown, { source, page_count: pages })}
          />
          <div className="ip-pdf-actions">
            <a
              className="ip-btn ip-touch"
              href={job.downloadUrl}
              onClick={() => emit(PROOF_EVENTS.downloaded, { source })}
            >
              Download PDF
            </a>
            {sample && (
              <a className="ip-btn ip-touch" href="/csv-templates/directory-classic-template.csv" download="directory-classic.csv">
                Download the template for your own
              </a>
            )}
          </div>
          <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-3)" }}>
            {sample
              ? "This is the real InDesign render of the sample directory, in your colours. Fill in the template with your own households to make yours. "
              : ""}
            The link is private to this PDF and stops working after 48 hours, when the CSV and
            PDF are deleted.
          </p>
        </div>
      )}

      {onStartOver && (
        <p style={{ marginTop: "var(--proof-space-4)" }}>
          <button type="button" className="ip-btn ip-btn-ghost ip-touch" onClick={onStartOver}>
            {completed || failed ? "Create another PDF" : "Start over"}
          </button>
        </p>
      )}
    </section>
  );
}
