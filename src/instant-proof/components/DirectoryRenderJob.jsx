import { useEffect, useRef, useState } from "react";

const submissions = new WeakMap();
const LABELS = ["Choose Directory Classic", "Upload Spreadsheet", "Generate and download proof"];

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The render service could not complete the request.");
  return body;
}

function submit(csv, templateId) {
  if (!submissions.has(csv)) {
    const form = new FormData();
    form.set("templateId", templateId);
    form.set("csv", csv, csv.name);
    submissions.set(csv, fetch("/api/render-jobs", { method: "POST", body: form }).then(responseJson));
  }
  return submissions.get(csv);
}

/*
 * `showSteps` and `onStartOver` are for the standalone resumed-job view, where
 * this component IS the page. Embedded under a finished proof (DirectoryPdfOffer)
 * both are omitted: the three-step list is already above it in the wizard
 * chrome, and Start over belongs to the results screen, not to one section of it.
 */
export default function DirectoryRenderJob({
  csv,
  templateId,
  initialJobId,
  onJobId,
  onStartOver,
  showSteps = false,
}) {
  const [job, setJob] = useState(initialJobId ? { jobId: initialJobId, status: "uploaded" } : null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(!initialJobId);
  /* `active` needs `csv` to have arrived; the offer builds it lazily, so a
     first render with csv===undefined is normal rather than an error. */
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (initialJobId || !csv) return;
    submit(csv, templateId).then((created) => {
      if (!mounted.current) return;
      setJob(created); setSubmitting(false); onJobId(created.jobId);
    }).catch((failure) => {
      if (!mounted.current) return;
      setError(failure.message); setSubmitting(false);
    });
  }, [csv, initialJobId, onJobId, templateId]);

  useEffect(() => {
    const jobId = job?.jobId || initialJobId;
    if (!jobId || job?.status === "completed" || job?.status === "failed") return undefined;
    let cancelled = false, timer;
    const poll = async () => {
      try {
        const latest = await fetch(`/api/render-jobs/${jobId}`, { cache: "no-store" }).then(responseJson);
        if (cancelled) return;
        setJob(latest);
        if (latest.status !== "completed" && latest.status !== "failed") timer = setTimeout(poll, 2000);
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [initialJobId, job?.jobId, job?.status]);

  const completed = job?.status === "completed";
  const generating = job && ["uploaded", "queued", "processing"].includes(job.status);
  const active = completed ? 3 : generating ? 2 : 1;

  return (
    <section aria-live="polite" aria-busy={submitting || generating} className="ip-section">
      {showSteps && (
        <ol style={{ display: "grid", gap: "0.75rem", padding: 0, margin: "0 0 2rem", listStyle: "none" }}>
          {LABELS.map((label, index) => (
            <li key={label} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="ip-step-dot" aria-hidden="true">{index < active ? "✓" : index + 1}</span>
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      )}

      {submitting && <p>Uploading and validating your CSV…</p>}
      {job?.status === "queued" && <p>Your validated directory is queued for the local InDesign worker.</p>}
      {job?.status === "processing" && <p>The worker is generating your directory PDF.</p>}
      {job?.status === "failed" && <p role="alert" className="ip-error">{job.errorMessage || "The directory could not be generated."}</p>}
      {error && <p role="alert" className="ip-error">{error}</p>}
      {job?.rowCount > 0 && <p className="ip-muted">{job.rowCount} sorted record{job.rowCount === 1 ? "" : "s"} · Job {job.jobId}</p>}
      {completed && (
        <div className="ip-section-tight">
          {job.mockOutput && <p className="ip-notice"><strong>Local mock output:</strong> this PDF is the sample preview, not an InDesign render.</p>}
          <a className="ip-btn-primary ip-touch" href={job.downloadUrl}>Download directory PDF</a>
        </div>
      )}
      {onStartOver && (
        <p><button type="button" className="ip-btn-ghost ip-touch" onClick={onStartOver}>Start over</button></p>
      )}
    </section>
  );
}
