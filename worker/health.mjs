#!/usr/bin/env node
/*
 * Worker health check.
 *
 *   node health.mjs          human-readable
 *   node health.mjs --json   one JSON object
 *
 * Answers the questions an operator actually asks when a customer says their
 * PDF never arrived:
 *
 *   is this worker configured at all?
 *   can it see the InDesign template and the script?
 *   is InDesign installed?
 *   can it reach the API, and does the API accept its token?
 *
 * ── No secrets in the output ──
 *
 * The token is never printed, and neither is its length — a length narrows a
 * brute force and ends up in screenshots. The check reports only whether it is
 * set and whether the server accepted it, which is enough to tell "not
 * configured" from "wrong token" from "server down". The output is safe to
 * paste into a support thread.
 *
 * Exits 0 when everything needed to render is in place, 1 otherwise, so it can
 * be used as a launchd or monitoring probe.
 */

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { describe, loadConfig, validateConfig } from "./config.mjs";

const exists = (target) =>
  access(target, constants.R_OK).then(
    () => true,
    () => false
  );

/* `osascript -e 'id of application ...'` resolves the bundle without launching
   it, so a health check never starts InDesign as a side effect. */
function inDesignInstalled(bundleId) {
  return new Promise((resolve) => {
    execFile(
      "osascript",
      ["-e", `id of application id "${bundleId.replace(/"/g, '\\"')}"`],
      { timeout: 10000 },
      (error) => resolve(!error)
    );
  });
}

/**
 * Ask the API whether our token works.
 *
 * The claim endpoint is the honest probe — it is the one the worker actually
 * depends on — but claiming a real job as a side effect of a health check would
 * be rude. A GET is used instead: the endpoint rejects the method, but only
 * AFTER the token has been checked, so 401 and 405 cleanly separate a bad token
 * from a good one.
 */
async function checkApi(config) {
  if (!config.apiUrl || !config.token) {
    return { reachable: false, authorized: false, detail: "not configured" };
    }
  try {
    const response = await fetch(`${config.apiUrl}/api/render-jobs/worker/claim`, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
    });
    if (response.status === 401) {
      return { reachable: true, authorized: false, detail: "the server rejected this worker token" };
    }
    if (response.status === 503) {
      const body = await response.json().catch(() => ({}));
      return { reachable: true, authorized: true, detail: body.error || "render storage is not configured" };
    }

    /* Authorized. Ask how much work is waiting — counts only, no job data. */
    const queue = await fetch(`${config.apiUrl}/api/render-jobs/worker/status`, {
      headers: { Authorization: `Bearer ${config.token}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    return { reachable: true, authorized: true, detail: `HTTP ${response.status}`, queue };
  } catch (error) {
    return { reachable: false, authorized: false, detail: error.message };
  }
}

const config = loadConfig();
const problems = validateConfig(config);

const [templateFound, scriptFound, indesignFound, api] = await Promise.all([
  config.templatePath ? exists(config.templatePath) : Promise.resolve(false),
  config.scriptPath ? exists(config.scriptPath) : Promise.resolve(false),
  inDesignInstalled(config.indesignBundleId),
  checkApi(config),
]);

const report = {
  ...describe(config),
  configurationProblems: problems,
  templateFound,
  scriptFound,
  indesignFound,
  apiReachable: api.reachable,
  apiAuthorized: api.authorized,
  apiDetail: api.detail,
  queueWaiting: api.queue?.queued ?? null,
  queueHeldByWorker: api.queue?.active ?? null,
  jobsHoldingFiles: api.queue?.tracked ?? null,
};

const healthy =
  problems.length === 0 && templateFound && scriptFound && indesignFound && api.reachable && api.authorized;
report.healthy = healthy;

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  const mark = (ok) => (ok ? "ok  " : "FAIL");
  const lines = [
    `Pressmark render worker — ${healthy ? "healthy" : "NOT READY"}`,
    "",
    `  ${mark(problems.length === 0)} configuration`,
    `  ${mark(report.tokenConfigured)} worker token set (value and length not shown)`,
    `  ${mark(templateFound)} InDesign template   ${report.templatePath}`,
    `  ${mark(scriptFound)} merge script        ${report.scriptPath}`,
    `  ${mark(indesignFound)} InDesign installed  ${report.indesignBundleId}`,
    `  ${mark(api.reachable)} API reachable       ${report.apiUrl}`,
    `  ${mark(api.authorized)} API authorized      ${api.detail}`,
    "",
    `  worker id ${report.workerId}`,
    `  work dir  ${report.workDir}`,
  ];
  if (api.queue) {
    lines.push(
      "",
      `  queue: ${api.queue.queued} waiting · ${api.queue.active} held by a worker · ${api.queue.tracked} holding files`
    );
  }
  for (const problem of problems) lines.push(`  ! ${problem}`);
  process.stdout.write(`${lines.join("\n")}\n`);
}

process.exit(healthy ? 0 : 1);
