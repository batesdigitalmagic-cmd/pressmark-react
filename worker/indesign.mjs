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
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
 * Run one render.
 *
 * @returns {Promise<{status: "completed"|"failed", message: string, pdfPath: string, timedOut: boolean}>}
 */
export async function runInDesignJob(config, job, { onStage } = {}) {
  const { jobDir, csvPath, pdfPath, resultPath } = job;

  /* A result file left by a previous attempt would be read as this attempt's
     outcome. Remove it before InDesign starts, not after. */
  await rm(resultPath, { force: true });

  await writeHandoff(config.handoffPath, {
    jobId: job.jobId,
    template: config.templatePath,
    csv: csvPath,
    output: pdfPath,
    result: resultPath,
    log: path.join(jobDir, "PressmarkDirectoryMerge.log"),
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
