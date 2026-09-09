/*
 * Worker configuration, entirely from the environment.
 *
 * Nothing here is committed and nothing is prompted for. The token is read but
 * never returned by any function that formats output — `describe()` reports
 * only whether it is present and how long it is, which is enough to diagnose a
 * truncated paste without disclosing the value.
 */

import os from "node:os";
import path from "node:path";

const int = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function loadConfig(env = process.env) {
  const apiUrl = String(env.PRESSMARK_API_URL || "").replace(/\/+$/, "");
  const token = String(env.PRESSMARK_WORKER_TOKEN || "");

  return {
    apiUrl,
    token,
    /* Identifies this Mac in the job record so ownership can be proved. Not a
       secret, and deliberately human-readable in logs. */
    workerId: String(env.PRESSMARK_WORKER_ID || `${os.hostname()}-${process.pid}`).slice(0, 100),

    /* The production InDesign template. Never inside the repo — it is a binary
       design asset that lives on the operator's Mac. */
    templatePath: String(env.PRESSMARK_INDD_TEMPLATE || ""),

    /* The ExtendScript this drives. Defaults to the copy in this checkout. */
    scriptPath: String(
      env.PRESSMARK_JSX_SCRIPT ||
        path.resolve(process.cwd(), "../scripts/indesign/PressmarkDirectoryMerge.jsx")
    ),

    /* Where the JSX looks for its handoff file. Must match JOB_HANDOFF_PATH in
       PressmarkDirectoryMerge.jsx. */
    handoffPath: String(
      env.PRESSMARK_JSX_HANDOFF ||
        path.join(os.homedir(), "Library/Application Support/Pressmark/current-render-job.txt")
    ),

    /* Per-job scratch. Customer CSV and PDF live here and only here, and only
       until the job ends. */
    workDir: String(env.PRESSMARK_WORKER_WORK_DIR || path.join(os.tmpdir(), "pressmark-worker")),

    indesignBundleId: String(env.PRESSMARK_INDESIGN_BUNDLE_ID || "com.adobe.InDesign"),

    pollMs: int(env.PRESSMARK_WORKER_POLL_MS, 5000),
    /* InDesign is slow and a large directory is slower. Generous, but bounded:
       a hung application must not hold a customer's job for ever. */
    renderTimeoutMs: int(env.PRESSMARK_RENDER_TIMEOUT_MS, 15 * 60 * 1000),
    /* Comfortably inside the server's 120s lease. */
    heartbeatMs: int(env.PRESSMARK_WORKER_HEARTBEAT_MS, 30 * 1000),
    maxBackoffMs: int(env.PRESSMARK_WORKER_MAX_BACKOFF_MS, 60 * 1000),
  };
}

/**
 * What is missing or wrong, as a list of human-readable problems.
 * Empty means the worker can start.
 */
export function validateConfig(config) {
  const problems = [];
  if (!config.apiUrl) problems.push("PRESSMARK_API_URL is not set.");
  else if (!/^https?:\/\//.test(config.apiUrl)) problems.push("PRESSMARK_API_URL must start with http:// or https://.");
  if (!config.token) problems.push("PRESSMARK_WORKER_TOKEN is not set.");
  else if (config.token.length < 32) problems.push("PRESSMARK_WORKER_TOKEN looks too short to be the generated token.");
  if (!config.templatePath) problems.push("PRESSMARK_INDD_TEMPLATE is not set.");
  if (!config.scriptPath) problems.push("PRESSMARK_JSX_SCRIPT is not set.");
  return problems;
}

/**
 * Safe to print and safe to paste into a support thread.
 *
 * This deliberately does NOT report the token's length. It used to, as a way to
 * spot a truncated paste — but the worker logs this object verbatim on every
 * start, so the length went into the log file, into launchd's stdout, and into
 * every screenshot of a startup line. A length narrows a brute force and buys
 * almost nothing diagnostically: a wrong token shows up immediately and
 * unambiguously as `API authorized FAIL` in the health check.
 */
export function describe(config) {
  return {
    apiUrl: config.apiUrl || "(unset)",
    workerId: config.workerId,
    tokenConfigured: Boolean(config.token),
    templatePath: config.templatePath || "(unset)",
    scriptPath: config.scriptPath,
    handoffPath: config.handoffPath,
    workDir: config.workDir,
    indesignBundleId: config.indesignBundleId,
    pollMs: config.pollMs,
    renderTimeoutMs: config.renderTimeoutMs,
    heartbeatMs: config.heartbeatMs,
  };
}
