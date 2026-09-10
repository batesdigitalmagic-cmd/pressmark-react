/*
 * Pressmark Instant Proof — Church Directory Classic.
 *
 * The whole flow, deliberately:
 *
 *   upload a CSV -> headers checked -> "CSV accepted" -> one button -> PDF
 *
 * ── What this page does NOT do ──
 *
 * No column mapping, no publication chooser, no design carousel, no photo
 * upload, no browser mock proof, no branding fields, no accounts, no payment.
 * The customer's CSV already carries the exact merge-field headers, so there is
 * nothing to map; the .indd and PressmarkDirectoryMerge.jsx are used exactly as
 * they already work.
 *
 * The proof IS the InDesign PDF. This page used to compose a mock proof in the
 * browser first — a second rendering path to keep honest, for no gain once the
 * real renderer worked.
 *
 * ── Why this page is not part of App.jsx ──
 *
 * The site is a multi-page Vite build (see vite.config.js). Each route is its
 * own HTML entry with its own static <head>, which is what makes the marketing
 * pages indexable without SSR: instant-proof.html -> src/instant-proof.jsx ->
 * this component. vercel.json sets cleanUrls, so the .html suffix never appears.
 *
 * ── Privacy ──
 *
 * The CSV is a browser File in React state until the visitor presses Generate.
 * Nothing is written to localStorage and no field value is logged. Once
 * submitted it goes to private storage, and the server deletes it as soon as
 * the render succeeds.
 */

import { useCallback, useState } from "react";

import DirectoryRenderJob from "../instant-proof/components/DirectoryRenderJob.jsx";
import { ProofHeader, ProofFooter } from "../instant-proof/components/ProofChrome.jsx";
import { parseCsvFile } from "../instant-proof/csv/parseCsv.js";
import { columnsOf, requiredColumnsOf, schemaFor } from "../instant-proof/csv/schemas.js";
import { IP_CSS } from "../instant-proof/styles.js";
import { PROOF_CSS } from "../instant-proof/theme.css.js";

const TEMPLATE_ID = "directory-classic";
const SCHEMA = schemaFor("church-directory");
const REQUIRED = requiredColumnsOf(SCHEMA);
const OPTIONAL = columnsOf(SCHEMA).filter((column) => !REQUIRED.includes(column));

/* The server refuses anything larger, so refuse it here where we can say why. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Check the file the visitor chose.
 *
 * Header names only — this does not map, rename or guess. An unrecognised
 * column is an error rather than something to silently drop, because a
 * misspelled `frist_name` would otherwise surface as a missing required column
 * and send the customer hunting for the wrong problem.
 *
 * @returns {{ok: true, recordCount: number}|{ok: false, error: string}}
 */
async function inspectCsv(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, error: "That is not a .csv file. Export your spreadsheet as CSV and try again." };
  }
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "That file is larger than 2 MB. A directory CSV should be far smaller." };
  }

  let table;
  try {
    table = await parseCsvFile(file);
  } catch {
    return { ok: false, error: "We could not read that CSV. Check that it opens in a spreadsheet program." };
  }

  const headers = table.headers.map((header) => header.trim());
  const missing = REQUIRED.filter((column) => !headers.includes(column));
  const unknown = headers.filter(
    (header) => header !== "" && !REQUIRED.includes(header) && !OPTIONAL.includes(header)
  );

  if (missing.length > 0 || unknown.length > 0) {
    const parts = [];
    if (missing.length > 0) {
      parts.push(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
    }
    if (unknown.length > 0) {
      parts.push(`Unrecognised column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
    }
    return { ok: false, error: parts.join(" ") };
  }

  if (table.rows.length === 0) {
    return { ok: false, error: "That CSV has headers but no records." };
  }

  return { ok: true, recordCount: table.rows.length };
}

export default function InstantProof() {
  /* A job id in the URL means the visitor refreshed or came back; resume it. */
  const [resumeJobId] = useState(
    () => new URLSearchParams(window.location.search).get("job") || ""
  );

  const [file, setFile] = useState(null);
  const [accepted, setAccepted] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  /* Set when the visitor presses Generate — this is what mounts the job. */
  const [submitted, setSubmitted] = useState(Boolean(resumeJobId));

  const choose = useCallback(async (chosen) => {
    if (!chosen) return;
    setChecking(true);
    setError("");
    setAccepted(null);
    setFile(null);

    const result = await inspectCsv(chosen);
    setChecking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFile(chosen);
    setAccepted(result);
  }, []);

  /* Keep the job id in the URL so a refresh resumes rather than losing it. */
  const rememberJob = useCallback((created) => {
    const url = new URL(window.location.href);
    url.searchParams.set("job", created);
    window.history.replaceState({}, "", url);
  }, []);

  const startOver = useCallback(() => {
    setFile(null);
    setAccepted(null);
    setError("");
    setSubmitted(false);
    window.history.replaceState({}, "", window.location.pathname);
    /* The resumed id is fixed for the life of the page, so a resumed job needs
       a genuine reload to clear. */
    if (resumeJobId) window.location.assign(window.location.pathname);
  }, [resumeJobId]);

  return (
    <div className="ip-root">
      <style>{IP_CSS}</style>
      <style>{PROOF_CSS}</style>

      <ProofHeader />

      <main style={{ flex: 1 }}>
        <div className="ip-page">
          <div className="ip-section-tight">
            <p className="ip-eyebrow">Church Directory Classic</p>
            <h1 className="ip-h1">Free directory proof</h1>
            <p className="ip-lead">
              Upload your directory CSV and we will typeset it through our InDesign production
              template. You get the finished PDF, not a mock-up.
            </p>

            {submitted ? (
              <div className="ip-section">
                <DirectoryRenderJob
                  csv={file ?? undefined}
                  templateId={TEMPLATE_ID}
                  initialJobId={resumeJobId}
                  onJobId={rememberJob}
                  onStartOver={startOver}
                />
              </div>
            ) : (
              <>
                {/* ── 1. The columns we need ── */}
                <div className="ip-section">
                  <p className="ip-label">Your CSV needs these columns</p>
                  <ul className="ip-note" style={{ columns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
                    {REQUIRED.map((column) => (
                      <li key={column}>
                        <code>{column}</code> — required
                      </li>
                    ))}
                    {OPTIONAL.map((column) => (
                      <li key={column} className="ip-muted">
                        <code>{column}</code> — optional
                      </li>
                    ))}
                  </ul>
                  <p className="ip-note ip-muted">
                    Header names must match exactly. Nothing else is needed — no record ID, no
                    display name, no photographs.
                  </p>
                </div>

                {/* ── 2. Choose the file ── */}
                <div className="ip-section">
                  <label
                    className="ip-btn ip-btn-ghost ip-touch"
                    style={{ cursor: "pointer", display: "inline-block" }}
                  >
                    Choose your CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="ip-sr-only"
                      onChange={(event) => {
                        choose(event.target.files?.[0] ?? null);
                        /* Reset so re-choosing the same file fires change again. */
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {checking && <p className="ip-note">Checking your CSV…</p>}
                </div>

                {/* ── 3. What we found ── */}
                {error && (
                  <p role="alert" className="ip-error ip-section">
                    {error}
                  </p>
                )}

                {accepted && (
                  <div className="ip-section" aria-live="polite">
                    <p className="ip-notice">
                      <strong>
                        CSV accepted — {accepted.recordCount} record
                        {accepted.recordCount === 1 ? "" : "s"}.
                      </strong>{" "}
                      {file?.name}
                    </p>

                    {/* ── 4. The one button ── */}
                    <button
                      type="button"
                      className="ip-btn ip-btn-gold ip-touch"
                      style={{ marginTop: "var(--proof-space-4)" }}
                      onClick={() => setSubmitted(true)}
                    >
                      Generate My PDF Proof
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <ProofFooter />
    </div>
  );
}
