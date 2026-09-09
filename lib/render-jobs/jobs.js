/*
 * Render-job state, on Upstash Redis.
 *
 * SERVER ONLY. Never import from src/.
 *
 * ── Why Redis and not the filesystem ──
 *
 * The previous adapter kept job metadata as JSON files under
 * `.pressmark-render-jobs/`. Vercel's filesystem is ephemeral and per-instance,
 * so in production two requests could land on different instances and disagree
 * about the same job — and nothing survived a redeploy. `getRenderJobStorage()`
 * therefore refused to run outside local development, which is why the live
 * flow could never finish.
 *
 * Upstash Redis is already provisioned for licences (lib/license-store.js) and
 * is reused here through the same REST `command()` runner: no new resource, no
 * new credential, and it works on both the Edge and Node runtimes because it is
 * plain fetch.
 *
 * ── The lease, and why the claim is a separate key ──
 *
 * A worker must never be handed a job another worker is already rendering. The
 * lease is NOT a field inside the job JSON — read-modify-write on a JSON blob
 * is not atomic and two workers can interleave and both "win".
 *
 * Instead the lease is its own key:
 *
 *   renderjob:claim:<id>  ->  workerId, with a TTL
 *
 * `SET ... NX EX` either creates it or fails, atomically, in one round trip.
 * The worker that gets "OK" owns the job; everyone else is told no. Ownership
 * is proved on every later write by comparing that key's value, which is what
 * makes a crashed worker recoverable: its claim key simply expires, and the
 * recovery sweep can requeue the job knowing nobody holds it.
 *
 * The two compare-and-set operations that must be atomic (renew-if-mine,
 * release-if-mine) are tiny Lua scripts. They compare strings only — no JSON
 * parsing in Lua — so there is nothing in them to go subtly wrong.
 *
 * ── Keys ──
 *
 *   renderjob:job:<id>     JSON job record, TTL = retention
 *   renderjob:queue        list of job ids waiting to be claimed
 *   renderjob:active       set of ids a worker is holding, for the sweep
 *   renderjob:claim:<id>   worker id holding the lease, TTL = lease seconds
 *
 * No customer content is stored here. The CSV and the PDF live in private blob
 * storage (lib/render-jobs/blob.js); this holds only ids, counts, timestamps
 * and a sanitized error string.
 */

import { command, kvConfigured } from "./kv.js";
import { StorageUnavailableError } from "./storage-errors.js";

export const JOB_STATUSES = {
  queued: "queued",
  claimed: "claimed",
  rendering: "rendering",
  completed: "completed",
  failed: "failed",
};

/* Terminal states never transition again; every write to one is a no-op that
   returns what is already there, which is what makes completion idempotent. */
const TERMINAL = new Set([JOB_STATUSES.completed, JOB_STATUSES.failed]);

/* A worker holds a job for this long before the sweep may take it back. Long
   enough that a slow InDesign render does not lose its own job, short enough
   that a crashed Mac does not strand a customer for an hour. The worker
   heartbeats at a fraction of this. */
export const LEASE_SECONDS = Number(process.env.PRESSMARK_RENDER_LEASE_SECONDS) || 120;

/* How long a job and its files are kept. The results page already promises the
   customer 48 hours. */
export const RETENTION_SECONDS =
  Number(process.env.PRESSMARK_RENDER_RETENTION_SECONDS) || 48 * 60 * 60;

/* Renders that failed for a transient reason are retried; a CSV InDesign
   genuinely cannot set will fail the same way every time, so the ceiling is
   low. */
export const MAX_ATTEMPTS = Number(process.env.PRESSMARK_RENDER_MAX_ATTEMPTS) || 3;

const jobKey = (id) => `renderjob:job:${id}`;
const claimKey = (id) => `renderjob:claim:${id}`;
const QUEUE_KEY = "renderjob:queue";
const ACTIVE_KEY = "renderjob:active";
/*
 * Every job that still owns files, scored by when it expires.
 *
 * `active` cannot serve this purpose: a job leaves `active` the moment it
 * completes, so a sweep driven by it would never revisit a finished job — and a
 * finished job is exactly the one holding a PDF. Redis drops the metadata on
 * its own when retention elapses, but blob objects have no TTL, so without this
 * index a completed customer's directory would sit in storage for ever with
 * nothing left pointing at it. Entries are removed only by deleteJob(), after
 * the objects are gone.
 */
const INDEX_KEY = "renderjob:index";

/** Job ids are 256-bit random hex; anything else is not ours. */
export function assertJobId(jobId) {
  if (!/^[a-f0-9]{64}$/.test(jobId || "")) throw new Error("Invalid job ID.");
  return jobId;
}

export function jobsConfigured() {
  return kvConfigured();
}

function requireStore() {
  if (!kvConfigured()) {
    throw new StorageUnavailableError(
      "Directory rendering needs its job store. Set KV_REST_API_URL and KV_REST_API_TOKEN " +
        "(Vercel → Storage → Upstash Redis)."
    );
  }
}

const nowIso = () => new Date().toISOString();

function parse(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/** Read one job. Returns null when it never existed or has aged out. */
export async function readJob(jobId) {
  requireStore();
  return parse(await command(["GET", jobKey(assertJobId(jobId))]));
}

/*
 * Write the record back, preserving whatever retention it has left.
 *
 * KEEPTTL matters: without it every progress heartbeat would reset the 48-hour
 * clock, so a job that kept being touched would never expire and the customer's
 * data would outlive the promise made to them.
 */
async function writeJob(job) {
  await command(["SET", jobKey(job.jobId), JSON.stringify(job), "KEEPTTL"]);
  return job;
}

/** Create the record and put it on the queue. */
export async function createJob(job) {
  requireStore();
  assertJobId(job.jobId);
  const record = {
    ...job,
    status: JOB_STATUSES.queued,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    workerId: "",
    leaseExpiresAt: "",
    heartbeatAt: "",
    progress: 0,
    progressMessage: "Waiting for a render worker",
    errorMessage: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    queuedAt: nowIso(),
    expiresAt: new Date(Date.now() + RETENTION_SECONDS * 1000).toISOString(),
  };
  /* EX here is what actually enforces retention on the metadata. */
  await command(["SET", jobKey(record.jobId), JSON.stringify(record), "EX", String(RETENTION_SECONDS)]);
  await command(["ZADD", INDEX_KEY, String(Date.parse(record.expiresAt)), record.jobId]);
  await command(["RPUSH", QUEUE_KEY, record.jobId]);
  return record;
}

/*
 * Renew the lease, but only if the caller still owns it.
 *
 * GET-then-EXPIRE as two calls would let a lease that expired in between be
 * re-extended by a worker that no longer holds it, while a second worker had
 * already taken the job — both would then render and both would upload.
 */
const RENEW_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

async function renewLease(jobId, workerId) {
  const result = await command([
    "EVAL",
    RENEW_SCRIPT,
    "1",
    claimKey(jobId),
    workerId,
    String(LEASE_SECONDS),
  ]);
  return Number(result) === 1;
}

async function releaseLease(jobId, workerId) {
  await command(["EVAL", RELEASE_SCRIPT, "1", claimKey(jobId), workerId]);
}

/**
 * Requeue jobs whose worker died.
 *
 * A holder's claim key carries a TTL. If it is gone while the job still says
 * claimed/rendering, no worker holds that job any more — the Mac crashed, lost
 * power, or was closed mid-render. The job goes back on the queue, or fails for
 * good once it has burned its attempts.
 *
 * Safe to run concurrently: requeueing is guarded by taking the claim key with
 * NX first, so two sweepers cannot both push the same id.
 */
export async function recoverExpiredLeases() {
  requireStore();
  const ids = await command(["SMEMBERS", ACTIVE_KEY]);
  if (!Array.isArray(ids) || ids.length === 0) return { recovered: 0, failed: 0 };

  let recovered = 0;
  let failed = 0;

  for (const id of ids) {
    const held = Number(await command(["EXISTS", claimKey(id)]));
    if (held === 1) continue;

    const job = await readJob(id).catch(() => null);
    if (!job) {
      await command(["SREM", ACTIVE_KEY, id]);
      continue;
    }
    if (TERMINAL.has(job.status) || job.status === JOB_STATUSES.queued) {
      await command(["SREM", ACTIVE_KEY, id]);
      continue;
    }

    /* Claim the recovery itself, so two sweeps cannot both requeue it. */
    const token = `recovery-${Date.now()}`;
    const won = await command(["SET", claimKey(id), token, "NX", "EX", "30"]);
    if (won !== "OK") continue;

    if (job.attempts >= job.maxAttempts) {
      await writeJob({
        ...job,
        status: JOB_STATUSES.failed,
        errorMessage: "The render worker stopped responding and the job ran out of attempts.",
        failedAt: nowIso(),
        updatedAt: nowIso(),
        workerId: "",
        leaseExpiresAt: "",
      });
      failed += 1;
    } else {
      await writeJob({
        ...job,
        status: JOB_STATUSES.queued,
        workerId: "",
        leaseExpiresAt: "",
        progress: 0,
        progressMessage: "Waiting for a render worker",
        updatedAt: nowIso(),
        queuedAt: nowIso(),
      });
      await command(["RPUSH", QUEUE_KEY, id]);
      recovered += 1;
    }
    await command(["SREM", ACTIVE_KEY, id]);
    await command(["DEL", claimKey(id)]);
  }

  return { recovered, failed };
}

/**
 * Hand exactly one queued job to exactly one worker.
 *
 * Pops an id, then takes the lease with SET NX. Only the worker that gets "OK"
 * proceeds; anyone racing it is handed nothing rather than the same job.
 *
 * Returns null when the queue is empty.
 */
export async function claimNextJob(workerId) {
  requireStore();
  if (!workerId) throw new Error("A worker id is required to claim a job.");

  /* One recovery pass first, so a job stranded by a crashed worker is offered
     again rather than sitting in `active` for ever. */
  await recoverExpiredLeases();

  /* Bounded: each iteration either returns or discards one unusable id, so a
     queue full of stale ids cannot spin for ever. */
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const jobId = await command(["LPOP", QUEUE_KEY]);
    if (!jobId) return null;

    const acquired = await command([
      "SET",
      claimKey(jobId),
      workerId,
      "NX",
      "EX",
      String(LEASE_SECONDS),
    ]);
    if (acquired !== "OK") continue;

    const job = await readJob(jobId).catch(() => null);
    /* Aged out, already finished, or taken by a recovery — let it go and give
       back the lease so nothing is left holding a key for a dead job. */
    if (!job || job.status !== JOB_STATUSES.queued) {
      await releaseLease(jobId, workerId);
      continue;
    }

    const claimed = {
      ...job,
      status: JOB_STATUSES.claimed,
      workerId,
      attempts: (job.attempts ?? 0) + 1,
      claimedAt: nowIso(),
      updatedAt: nowIso(),
      heartbeatAt: nowIso(),
      leaseExpiresAt: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString(),
      progress: 0,
      progressMessage: "Preparing to render",
      errorMessage: "",
    };
    await writeJob(claimed);
    await command(["SADD", ACTIVE_KEY, jobId]);
    return claimed;
  }

  return null;
}

/**
 * Heartbeat: renew the lease and report progress.
 *
 * Returns null when the caller no longer owns the job, which is the worker's
 * signal to abandon the render rather than upload a result someone else's job
 * is now expecting.
 */
export async function heartbeatJob(jobId, workerId, { progress, progressMessage, status } = {}) {
  requireStore();
  const job = await readJob(jobId);
  if (!job) return null;
  if (TERMINAL.has(job.status)) return job;

  const stillMine = await renewLease(jobId, workerId);
  if (!stillMine || job.workerId !== workerId) return null;

  const next = {
    ...job,
    status: status === JOB_STATUSES.rendering ? JOB_STATUSES.rendering : job.status,
    progress: typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : job.progress,
    progressMessage: progressMessage ? String(progressMessage).slice(0, 200) : job.progressMessage,
    heartbeatAt: nowIso(),
    updatedAt: nowIso(),
    leaseExpiresAt: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString(),
  };
  if (next.status === JOB_STATUSES.rendering && !next.renderingAt) next.renderingAt = nowIso();
  return writeJob(next);
}

/**
 * Mark a job completed. Idempotent.
 *
 * A worker whose upload succeeded but whose completion call was lost will call
 * again; the second call must not error and must not undo anything. Calling on
 * an already-completed job returns the existing record unchanged.
 */
export async function completeJob(jobId, workerId, { pdfKey, mockOutput = false } = {}) {
  requireStore();
  const job = await readJob(jobId);
  if (!job) return null;
  if (job.status === JOB_STATUSES.completed) return job;
  if (job.status === JOB_STATUSES.failed) return job;
  /* Ownership is required to finish a live job, so a stale worker cannot
     complete a job that was recovered and handed to someone else. */
  if (job.workerId && workerId && job.workerId !== workerId) return null;

  const done = {
    ...job,
    status: JOB_STATUSES.completed,
    pdfKey: pdfKey ?? job.pdfKey,
    mockOutput: Boolean(mockOutput),
    progress: 100,
    progressMessage: "Your directory PDF is ready",
    errorMessage: "",
    completedAt: nowIso(),
    updatedAt: nowIso(),
  };
  await writeJob(done);
  await command(["SREM", ACTIVE_KEY, jobId]);
  if (workerId) await releaseLease(jobId, workerId);
  return done;
}

/**
 * Mark a job failed, or put it back for another attempt. Idempotent.
 *
 * The message is bounded and is written by us, not echoed from InDesign's own
 * output — a stack trace or a file path from the worker's disk must never reach
 * a customer's browser.
 */
export async function failJob(jobId, workerId, message, { retry = true } = {}) {
  requireStore();
  const job = await readJob(jobId);
  if (!job) return null;
  if (TERMINAL.has(job.status)) return job;
  if (job.workerId && workerId && job.workerId !== workerId) return null;

  const errorMessage = String(message || "The directory could not be rendered.").slice(0, 300);
  const canRetry = retry && (job.attempts ?? 0) < (job.maxAttempts ?? MAX_ATTEMPTS);

  const next = canRetry
    ? {
        ...job,
        status: JOB_STATUSES.queued,
        workerId: "",
        leaseExpiresAt: "",
        progress: 0,
        progressMessage: "Waiting to try again",
        errorMessage,
        updatedAt: nowIso(),
        queuedAt: nowIso(),
      }
    : {
        ...job,
        status: JOB_STATUSES.failed,
        workerId: "",
        leaseExpiresAt: "",
        errorMessage,
        failedAt: nowIso(),
        updatedAt: nowIso(),
      };

  await writeJob(next);
  await command(["SREM", ACTIVE_KEY, jobId]);
  if (workerId) await releaseLease(jobId, workerId);
  if (canRetry) await command(["RPUSH", QUEUE_KEY, jobId]);
  return next;
}

/** Test and operational hook: how deep the queue is right now. */
export async function queueDepth() {
  requireStore();
  return Number(await command(["LLEN", QUEUE_KEY])) || 0;
}

/** Jobs a worker is currently holding. Operational visibility only. */
export async function activeJobIds() {
  requireStore();
  const ids = await command(["SMEMBERS", ACTIVE_KEY]);
  return Array.isArray(ids) ? ids : [];
}

/**
 * Forget a job entirely.
 *
 * Redis expiry removes the metadata on its own, but blob objects have no TTL —
 * the caller deletes those and then calls this so nothing is left pointing at
 * files that are gone.
 */
export async function deleteJob(jobId) {
  requireStore();
  assertJobId(jobId);
  await command(["DEL", jobKey(jobId)]);
  await command(["DEL", claimKey(jobId)]);
  await command(["SREM", ACTIVE_KEY, jobId]);
  await command(["ZREM", INDEX_KEY, jobId]);
}

/**
 * Job ids whose retention window has closed and whose files still need deleting.
 *
 * Read from the index rather than from `active`, so a job that completed hours
 * ago is still found — that is the whole point of keeping a separate index.
 */
export async function expiredJobIds(limit = 100) {
  requireStore();
  const ids = await command([
    "ZRANGEBYSCORE",
    INDEX_KEY,
    "0",
    String(Date.now()),
    "LIMIT",
    "0",
    String(limit),
  ]);
  return Array.isArray(ids) ? ids : [];
}

/** How many jobs still hold files. Operational visibility only. */
export async function trackedJobCount() {
  requireStore();
  return Number(await command(["ZCARD", INDEX_KEY])) || 0;
}
