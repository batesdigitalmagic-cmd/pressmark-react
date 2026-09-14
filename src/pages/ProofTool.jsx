/*
 * Pressmark Studio — the homepage, which is the tool.
 *
 * The whole flow, in one column:
 *
 *   choose a design → download the template → upload the completed CSV and
 *   choose two colours → create the PDF
 *
 * ── One surface, not four cards ──
 *
 * Every action lives in the composer at the bottom: a "+" for the template, the
 * upload and the instructions, a colour mark for the two swatches, and the one
 * button that finishes the job. What is left above it is the heading, the four
 * steps, and the two designs — the things a customer reads rather than presses.
 *
 * The step rail is what keeps this honest. Hiding controls is only simpler if
 * the customer can still see where they are, so the rail stays visible and is
 * derived from real state.
 *
 * ── What this page does NOT do ──
 *
 * No column mapping, no Record ID, no Display Name, no Photo Filename, no
 * publication chooser, no photo upload, no browser mock-up, no accounts, no
 * payment. The customer's CSV carries the exact merge-field headers the
 * production template expects, because they started from the file we handed
 * them, so there is nothing to map.
 *
 * ── The PDF is a real InDesign export ──
 *
 * There is one render path and the page composes nothing itself. It is also
 * free and unconditional: this is a tool, not a sample of work to be bought
 * afterwards, so nothing here calls the result a "proof" or holds anything
 * back.
 *
 * ── Try it with sample data ──
 *
 * A visitor without a spreadsheet can load our own made-up directory
 * (public/samples), choose colours, and render it through exactly the same
 * pipeline a customer's file goes through. The result is previewed in the page,
 * so it can be judged on a phone or a desktop without downloading anything.
 * It is a real render, not a canned file: the colours are theirs.
 *
 * ── Privacy ──
 *
 * The CSV is a browser File in React state until the customer presses Create.
 * Nothing is written to storage and no field value is logged. Once submitted it
 * goes to private storage, and the server deletes it as soon as the render
 * succeeds.
 */

import { useCallback, useMemo, useRef, useState } from "react";

import AppShell from "../instant-proof/components/AppShell.jsx";
import BootScreen from "../instant-proof/components/BootScreen.jsx";
import Composer from "../instant-proof/components/Composer.jsx";
import DesignChooser from "../instant-proof/components/DesignChooser.jsx";
import DirectoryRenderJob from "../instant-proof/components/DirectoryRenderJob.jsx";
import { DEFAULT_COLORS, changedColors } from "../instant-proof/colors.js";
import { DEFAULT_DESIGN_ID, designFor, swatchKeysFor } from "../instant-proof/designs.js";
import { parseCsvFile } from "../instant-proof/csv/parseCsv.js";
import { columnsOf, requiredColumnsOf, schemaFor } from "../instant-proof/csv/schemas.js";

const SCHEMA = schemaFor("church-directory");
const REQUIRED = requiredColumnsOf(SCHEMA);
const OPTIONAL = columnsOf(SCHEMA).filter((column) => !REQUIRED.includes(column));

/* Twenty made-up households with 555 numbers and example.org addresses. */
const SAMPLE_CSV = "/samples/directory-classic-sample.csv";
const SAMPLE_NAME = "sample-directory.csv";

/* The server refuses anything larger, so refuse it here where we can say why. */
const MAX_BYTES = 2 * 1024 * 1024;

const STEPS = [
  "Choose a design",
  "Download and complete the template",
  "Upload your CSV and choose colours",
  "Create your PDF",
];

/**
 * Check the file the customer chose.
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
    parts.push("Start from our template and keep its heading row exactly as it is.");
    return { ok: false, error: parts.join(" ") };
  }

  if (table.rows.length === 0) {
    return { ok: false, error: "That CSV has headers but no records." };
  }

  return { ok: true, recordCount: table.rows.length };
}

export default function ProofTool() {
  /* A job id in the URL means the customer refreshed or came back; resume it. */
  const [resumeJobId] = useState(
    () => new URLSearchParams(window.location.search).get("job") || ""
  );
  /* Remembered in the address too, so a resumed sample job still says so. */
  const [sample, setSample] = useState(
    () => new URLSearchParams(window.location.search).get("sample") === "1"
  );

  const [designId, setDesignId] = useState(DEFAULT_DESIGN_ID);
  const [file, setFile] = useState(null);
  const [accepted, setAccepted] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [permitted, setPermitted] = useState(false);
  /* Set when the customer presses Create — this is what mounts the job. */
  const [submitted, setSubmitted] = useState(Boolean(resumeJobId));

  const instructions = useRef(null);
  const design = designFor(designId);
  /* Which of the six this design paints. Directory Classic uses three; the
     template carries all six for designs still to come. */
  const swatchKeys = swatchKeysFor(designId);

  const choose = useCallback(async (chosen, isSample = false) => {
    if (!chosen) return;
    setSample(isSample);
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

  /* The sample goes through the same checks as an upload, so it can never be
     something a real customer's file could not be. */
  const useSample = useCallback(async () => {
    try {
      const response = await fetch(SAMPLE_CSV);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      await choose(new File([blob], SAMPLE_NAME, { type: "text/csv" }), true);
    } catch {
      setError("The sample directory could not be loaded. Try again in a moment.");
    }
  }, [choose]);

  /* The menu item opens the disclosure and scrolls to it, rather than opening a
     second panel over the one the customer just used. */
  const openInstructions = useCallback(() => {
    const panel = instructions.current;
    if (!panel) return;
    panel.open = true;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  /* Keep the job id in the URL so a refresh resumes rather than losing it. */
  const rememberJob = useCallback((created) => {
    const url = new URL(window.location.href);
    url.searchParams.set("job", created);
    if (sample) url.searchParams.set("sample", "1");
    window.history.replaceState({}, "", url);
  }, [sample]);

  const startOver = useCallback(() => {
    setFile(null);
    setAccepted(null);
    setError("");
    setPermitted(false);
    setSample(false);
    setSubmitted(false);
    window.history.replaceState({}, "", window.location.pathname);
    /* The resumed id is fixed for the life of the page, so a resumed job needs
       a genuine reload to clear. */
    if (resumeJobId) window.location.assign(window.location.pathname);
  }, [resumeJobId]);

  /*
   * Which step the customer is on.
   *
   * Derived, never stored. A stored step is a second source of truth about the
   * same thing, and the two disagree the first time someone re-picks a file.
   */
  const activeStep = useMemo(() => {
    if (submitted || accepted) return 4;
    if (checking || error || file) return 3;
    return 2;
  }, [accepted, checking, error, file, submitted]);

  const stateOf = (index) => {
    if (submitted && index === 4) return "current";
    if (index < activeStep) return "done";
    return index === activeStep ? "current" : "todo";
  };

  const blocking = !accepted
    ? "Upload your completed CSV, or try the sample, to continue."
    : !permitted && !sample
      ? "Confirm you have permission to use this information."
      : "";

  return (
    <>
      <BootScreen />
      <AppShell current="/">
        <p className="ip-crumb">Publication PDF Builder</p>
        <h1 className="ip-h1">Create Your Directory PDF</h1>
        <p className="ip-lead">Start with the template, then upload your completed CSV.</p>

        {submitted ? (
          <section className="ip-card" style={{ marginTop: "var(--proof-space-6)" }}>
            <DirectoryRenderJob
              csv={file ?? undefined}
              templateId={design.id}
              /*
               * Only what the customer actually changed. A swatch that is not
               * sent is left exactly as the template has it, which is both the
               * honest thing to do and the only way to avoid the lossy CMYK
               * round trip repainting five colours nobody touched.
               */
              colors={changedColors(colors, swatchKeys)}
              initialJobId={resumeJobId}
              onJobId={rememberJob}
              onStartOver={startOver}
              sample={sample}
            />
          </section>
        ) : (
          <>
            <ol className="ip-steps" style={{ marginTop: "var(--proof-space-6)" }}>
              {STEPS.map((label, index) => (
                <li className="ip-step" key={label} data-state={stateOf(index + 1)}>
                  <span className="ip-step-n" aria-hidden="true">
                    {stateOf(index + 1) === "done" ? "✓" : index + 1}
                  </span>
                  {label}
                  {stateOf(index + 1) === "current" && (
                    <span className="ip-sr-only"> — current step</span>
                  )}
                </li>
              ))}
            </ol>

            <DesignChooser selectedId={designId} onSelect={setDesignId} />

            {/* The way in for someone who has not filled in a template yet. */}
            {!(sample && accepted) && (
              <section className="ip-card ip-sample" aria-labelledby="sample-title">
                <div className="ip-sample-text">
                  <h2 className="ip-sample-title" id="sample-title">
                    No spreadsheet yet? Try a sample render
                  </h2>
                  <p className="ip-note">
                    Load our sample directory of 20 households, choose your colours, and create a
                    real InDesign PDF. Preview it right here on your phone or computer, and download
                    it only if you want to.
                  </p>
                </div>
                <button type="button" className="ip-btn" onClick={useSample} disabled={checking}>
                  Use sample data
                </button>
              </section>
            )}

            {error && (
              <p role="alert" className="ip-error" style={{ marginTop: "var(--proof-space-5)" }}>
                {error}
              </p>
            )}

            {/*
              * The columns stay out of the interface. A customer who starts from
              * the template cannot get them wrong, which is the only way this
              * flow fails — so the file is the answer, and this panel is here
              * for the one person who needs the detail anyway.
              */}
            <details className="ip-details" ref={instructions}>
              <summary>Template instructions</summary>
              <div className="ip-prose">
                <p>
                  Open the template in Excel, Numbers or Google Sheets. The first row is the
                  heading row — leave it exactly as it is, including the spelling and the
                  underscores. Everything below it is yours.
                </p>
                <ul>
                  <li>One household per row.</li>
                  <li>
                    A last name and a first name are needed on every row. The directory is
                    sorted by them.
                  </li>
                  <li>
                    Leave a cell empty when you do not have it. An empty phone number is a
                    normal directory entry, not a problem.
                  </li>
                  <li>Do not add, rename, reorder or delete columns.</li>
                  <li>
                    Save or export as <strong>CSV</strong>, not .xlsx or .numbers.
                  </li>
                </ul>
                <p>
                  <a href="/data-merge">The Data Merge section</a> covers the spreadsheet side in more
                  detail, including what clean data does for the finished design.
                </p>
                <p>
                  Ready to print? <a href="/blog/print-pdf-online">How to print a PDF online</a>{" "}
                  covers uploading your PDF to a print service and the checks that stop a reprint.
                </p>
              </div>
            </details>

            <div className="ip-composer-spacer" />
            <Composer
              design={design}
              swatchKeys={swatchKeys}
              colors={colors}
              defaults={DEFAULT_COLORS}
              onColorsChange={setColors}
              onFile={choose}
              onInstructions={openInstructions}
              file={file}
              accepted={accepted}
              checking={checking}
              permitted={permitted}
              onPermittedChange={setPermitted}
              blocking={blocking}
              onSubmit={() => setSubmitted(true)}
              sample={sample}
              onSample={useSample}
            />
          </>
        )}
      </AppShell>
    </>
  );
}
