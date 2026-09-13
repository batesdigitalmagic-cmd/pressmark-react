/*
 * Driving Adobe InDesign from the worker.
 *
 * ── How the job reaches the script ──
 *
 * The worker writes a handoff file, then asks InDesign to run
 * PressmarkDirectoryMerge.jsx. The script reads that file, deletes it, and
 * works from the paths it names — so no Finder dialog is ever shown.
 *
 * The handoff is a FILE rather than `do script ... with arguments` because the
 * script body is wrapped in an IIFE: the global `arguments` array InDesign
 * populates is shadowed there by the function's own `arguments`, and reading it
 * would silently yield the wrong value. See the comment at the top of the JSX.
 *
 * ── How the outcome comes back ──
 *
 * `do script` is synchronous, so osascript exiting means InDesign finished. But
 * "finished" is not "succeeded", and osascript's own exit code does not
 * distinguish a failed render from a failed AppleScript. The script therefore
 * writes a result file as its LAST action, and that file is the authority:
 *
 *   present, status=completed  the render worked
 *   present, status=failed     it did not, and says why
 *   absent                     InDesign died mid-run; treat as a failure the
 *                              worker may retry
 *
 * Both a timeout and a crash are therefore distinguishable from a genuine
 * render failure, which is what makes the retry policy meaningful.
 *
 * ── The per-job template copy ──
 *
 * Every render works on a copy of the .indd inside the job directory, never on
 * the operator's file. The script recolours two swatches before merging, and a
 * recolour is a document modification: even though the script closes without
 * saving, a crash between the swatch write and the close would leave InDesign
 * holding a modified production template with a recovery file beside it. The
 * copy makes that impossible to get wrong — the file that gets modified is one
 * the `finally` in pressmark-worker.mjs deletes with the rest of the job.
 *
 * Linked graphics still resolve: InDesign records an absolute path alongside
 * the relative one, and the originals have not moved. A template whose links
 * are stored relative-only would need them embedded.
 */

import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SWATCH_FOR, cmykToHandoff, hexToCmyk, normalizeHex } from "../src/instant-proof/colors.js";

/** Result-file keys are plain `key=value` lines; ES3 has no JSON. */
function parseResult(text) {
  const spec = {};
  for (const rawLine of String(text).split(/\r\n|\r|\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const split = line.indexOf("=");
    if (split > 0) spec[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return spec;
}

/**
 * Write the handoff the JSX consumes.
 *
 * Values must not contain newlines — a path with one would break the
 * key=value contract and the script would read a truncated path.
 */
export async function writeHandoff(handoffPath, spec) {
  for (const [key, value] of Object.entries(spec)) {
    if (/[\r\n]/.test(String(value))) {
      throw new Error(`Handoff value for ${key} contains a newline.`);
    }
  }
  await mkdir(path.dirname(handoffPath), { recursive: true });
  const body = Object.entries(spec)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await writeFile(handoffPath, `${body}\n`, "utf8");
}

/*
 * AppleScript is built here rather than templated from user input.
 *
 * Only two values vary — the bundle id and the script path — and both are
 * operator configuration, not customer data. They are still quoted defensively:
 * a stray double quote in a path would otherwise end the AppleScript string and
 * change the meaning of the command.
 */
function appleScript(bundleId, scriptPath) {
  const quote = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return [
    `tell application id "${quote(bundleId)}"`,
    `  do script (POSIX file "${quote(scriptPath)}") language javascript`,
    "end tell",
  ].join("\n");
}

/**
 * The swatch lines for the handoff, keyed by the InDesign swatch they set.
 *
 * `swatch.PM_Primary=100,90,10,0`. Naming the swatch in the key rather than
 * inventing a parallel vocabulary means the ExtendScript needs no list of its
 * own: it applies whatever it is handed, and adding a seventh colour is a row
 * in BRAND_COLORS and nothing else.
 *
 * A job that changed nothing produces {} and the document is never touched. A
 * malformed value is refused rather than silently dropped: the API validated
 * these, so anything unparseable here means the two definitions have drifted
 * apart, and rendering the wrong colour would hide that.
 */
export function swatchHandoff(brandColors = {}) {
  const lines = {};
  for (const [key, value] of Object.entries(brandColors ?? {})) {
    const swatch = SWATCH_FOR[key];
    if (!swatch) throw new Error(`This job carries an unknown brand colour: ${key}.`);
    const hex = normalizeHex(value);
    if (!hex) throw new Error(`This job's ${key} is not a six-digit hex colour.`);
    lines[`swatch.${swatch}`] = cmykToHandoff(hexToCmyk(hex));
  }
  return lines;
}

/*
 * ── Is InDesign free to take a job? ──
 *
 * A render can only run while InDesign has no dialog open. With one up — a
 * Missing Fonts alert, Preferences, a save prompt left by someone working on
 * this Mac — every scripting call that CHANGES anything is refused with
 * "Cannot handle the request because a modal dialog or alert is active". The
 * worker retries a failed render immediately, so a single forgotten dialog used
 * to fail a customer's job permanently in about two seconds.
 *
 * The probe writes the dialog preference back to the value it already holds.
 * Nothing changes, but the write is refused exactly when a dialog is open —
 * which reads cannot tell you, because they still succeed. Measured on this
 * Mac: with a dialog up, reading the level worked and setting it threw.
 */
const DIALOG_PROBE =
  "var level = app.scriptPreferences.userInteractionLevel; " +
  "try { app.scriptPreferences.userInteractionLevel = level; 'free'; } " +
  "catch (probeError) { 'blocked'; }";

/**
 * What the probe printed, as a state. Anything unrecognised is "unknown", and
 * the caller treats unknown as free: an inconclusive check must never stop the
 * worker taking jobs.
 *
 * @returns {"free"|"blocked"|"unknown"}
 */
export function parseDialogProbe(output) {
  const text = String(output ?? "").trim();
  if (text === "free") return "free";
  if (text === "blocked") return "blocked";
  return "unknown";
}

const runOsascript = (script, timeoutMs) =>
  new Promise((resolve) => {
    execFile("osascript", ["-e", script], { timeout: timeoutMs }, (error, stdout) => {
      resolve({ ok: !error, stdout: String(stdout ?? "") });
    });
  });

/**
 * InDesign's state, without disturbing it.
 *
 * `is running` is asked first, and it does not launch the application: if
 * InDesign is closed there is no dialog to wait for, and the render will start
 * it itself. Only a running InDesign is sent the probe.
 *
 * @returns {Promise<"not-running"|"free"|"blocked"|"unknown">}
 */
export async function indesignDialogState(config, { exec = runOsascript } = {}) {
  const quote = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const running = await exec(`application id "${quote(config.indesignBundleId)}" is running`, 10000);
  if (!running.ok) return "unknown";
  if (running.stdout.trim() !== "true") return "not-running";

  const probe = await exec(
    `tell application id "${quote(config.indesignBundleId)}" to do script "${quote(DIALOG_PROBE)}" language javascript`,
    15000
  );
  return probe.ok ? parseDialogProbe(probe.stdout) : "unknown";
}

/**
 * Run one render.
 *
 * @returns {Promise<{status: "completed"|"failed", message: string, pdfPath: string, timedOut: boolean}>}
 */
export async function runInDesignJob(config, job, { onStage } = {}) {
  const { jobDir, csvPath, pdfPath, resultPath } = job;

  /* A result file left by a previous attempt would be read as this attempt's
     outcome. Remove it before InDesign starts, not after. */
  await rm(resultPath, { force: true });

  /* The copy the script is allowed to modify. Same extension, because the
     script refuses anything that is not an .indd. */
  const templateCopy = path.join(jobDir, "template.indd");
  await copyFile(config.templatePath, templateCopy);

  await writeHandoff(config.handoffPath, {
    jobId: job.jobId,
    template: templateCopy,
    csv: csvPath,
    output: pdfPath,
    result: resultPath,
    log: path.join(jobDir, "PressmarkDirectoryMerge.log"),
    ...swatchHandoff(job.brandColors),
  });

  onStage?.("Starting InDesign");

  const script = appleScript(config.indesignBundleId, config.scriptPath);

  const outcome = await new Promise((resolve) => {
    const child = execFile(
      "osascript",
      ["-e", script],
      { timeout: config.renderTimeoutMs, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          failed: Boolean(error),
          timedOut: Boolean(error && error.killed),
          /* osascript's stderr can name paths; it is kept for the local log
             only and never forwarded to the server as a customer message. */
          detail: String(stderr || stdout || error?.message || "").trim().slice(0, 500),
        });
      }
    );
    child.on("error", () => {
      /* execFile's callback still fires; nothing to do here beyond not
         crashing the worker when osascript is missing entirely. */
    });
  });

  /*
   * The handoff is normally consumed by the script. If InDesign never got that
   * far it is still sitting there, and leaving it would let the NEXT manual run
   * pick up this job's paths.
   */
  await rm(config.handoffPath, { force: true });

  const resultText = await readFile(resultPath, "utf8").catch(() => "");

  if (!resultText) {
    return {
      status: "failed",
      timedOut: outcome.timedOut,
      pdfPath: "",
      message: outcome.timedOut
        ? "InDesign did not finish within the time allowed."
        : "InDesign stopped before it reported a result.",
      detail: outcome.detail,
    };
  }

  const parsed = parseResult(resultText);
  return {
    status: parsed.status === "completed" ? "completed" : "failed",
    timedOut: outcome.timedOut,
    pdfPath: parsed.pdf || "",
    message: parsed.message || "",
    detail: outcome.detail,
  };
}

/**
 * Confirm the file InDesign claims to have written is really a PDF.
 *
 * A truncated export, a zero-byte file left by a crash, or an error page saved
 * under a .pdf name would all reach the customer as a broken download. Checking
 * the signature and a floor on size here means the server never receives one.
 */
export async function verifyPdf(pdfPath, minimumBytes = 400) {
  const bytes = await readFile(pdfPath).catch(() => null);
  if (!bytes) return { ok: false, reason: "the PDF was not written", bytes: null };
  if (bytes.length < minimumBytes) return { ok: false, reason: "the PDF is empty or truncated", bytes: null };
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, reason: "the exported file is not a PDF", bytes: null };
  }
  return { ok: true, reason: "", bytes };
}
