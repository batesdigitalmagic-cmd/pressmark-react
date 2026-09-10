/*
 * Read-only view of the render queue.
 *
 *   node --env-file=.env --env-file=.env.render --env-file=.env.local \
 *     scripts/render-queue-status.mjs
 *
 * ── Read-only, deliberately ──
 *
 * Every command here is a read: LLEN, LRANGE, SMEMBERS, ZCARD, GET. Nothing
 * pops, claims, mutates or deletes. Checking what is waiting must never be the
 * thing that consumes it — calling the claim endpoint to "look" would hand a
 * real customer's job to whoever ran the check.
 *
 * ── What it will not print ──
 *
 * `originalFilename` is the name of the file a customer uploaded. It routinely
 * identifies the organisation ("First Baptist members.csv") and is none of an
 * operator's business when they are only asking how deep the queue is. It is
 * omitted, along with every storage path.
 *
 * Job ids are shown as an 8-character prefix: enough to correlate with a log
 * line, not enough to be the bearer capability that downloads the PDF.
 */

import { command, storeConfigured } from "../lib/license-store.js";

if (!storeConfigured) {
  process.stdout.write(
    "Render queue — job store is not configured in this environment.\n" +
      "  Set KV_REST_API_URL and KV_REST_API_TOKEN (or pull them with vercel env pull).\n"
  );
  process.exit(1);
}

const QUEUE_KEY = "renderjob:queue";
const ACTIVE_KEY = "renderjob:active";
const INDEX_KEY = "renderjob:index";

const asList = (value) => (Array.isArray(value) ? value : []);
const minutesSince = (iso) => {
  const when = Date.parse(iso || "");
  return Number.isFinite(when) ? Math.round((Date.now() - when) / 60000) : null;
};

const queued = asList(await command(["LRANGE", QUEUE_KEY, "0", "49"]));
const queueDepth = Number(await command(["LLEN", QUEUE_KEY])) || 0;
const active = asList(await command(["SMEMBERS", ACTIVE_KEY]));
const tracked = Number(await command(["ZCARD", INDEX_KEY])) || 0;

/** Only fields that describe the JOB, never the customer or the storage. */
async function safeMetadata(jobId) {
  const raw = await command(["GET", `renderjob:job:${jobId}`]);
  if (!raw) return { jobId, status: "(record expired)" };
  let job;
  try {
    job = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { jobId, status: "(unreadable record)" };
  }
  return {
    jobId,
    status: job.status,
    templateId: job.templateId,
    rowCount: job.rowCount,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    ageMinutes: minutesSince(job.createdAt),
    workerId: job.workerId || "",
    /* Our own message, never the customer's data. */
    progressMessage: job.progressMessage || "",
  };
}

const lines = ["Render queue — read-only status", ""];
lines.push(`  waiting to be claimed : ${queueDepth}`);
lines.push(`  held by a worker      : ${active.length}`);
lines.push(`  tracked (hold files)  : ${tracked}`);
lines.push("");

const ids = [...new Set([...queued, ...active])];

if (ids.length === 0) {
  lines.push("  The queue is empty. Nothing is waiting and no worker holds a job.");
} else {
  lines.push(`  ${ids.length} job(s) present. Safe metadata only — no filename, no customer data:`);
  lines.push("");
  for (const id of ids.slice(0, 50)) {
    const meta = await safeMetadata(id);
    lines.push(`    ${String(meta.jobId).slice(0, 8)}…  ${String(meta.status).padEnd(10)}` +
      `  ${meta.templateId ?? "?"}` +
      `  rows=${meta.rowCount ?? "?"}` +
      `  attempt=${meta.attempts ?? "?"}/${meta.maxAttempts ?? "?"}` +
      `  age=${meta.ageMinutes ?? "?"}m` +
      (meta.workerId ? `  worker=${meta.workerId}` : ""));
    if (meta.progressMessage) lines.push(`               ${meta.progressMessage}`);
  }
}

lines.push("");
process.stdout.write(lines.join("\n"));
