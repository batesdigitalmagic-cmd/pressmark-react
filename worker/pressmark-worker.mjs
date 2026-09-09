#!/usr/bin/env node
/*
 * The Pressmark Directory Classic render worker.
 *
 * Runs continuously on the operator's Mac — never in Vercel, never in a
 * browser. It polls for a queued job, claims exactly one, renders it through
 * Adobe InDesign, uploads the PDF, and starts again.
 *
 *   node pressmark-worker.mjs
 *
 * ── One job at a time, deliberately ──
 *
 * InDesign is a single desktop application driving one document at a time; two
 * concurrent renders would fight over the same template and the same
 * application state. The loop is therefore strictly sequential. Throughput
 * comes from the queue, not from concurrency here.
 *
 * ── What is on disk, and for how long ──
 *
 * Each job gets its own directory under the work dir. The customer's CSV is
 * written there, InDesign writes the PDF beside it, and the whole directory is
 * removed in a finally block — on success, on failure, on timeout, and on
 * shutdown. Customer data does not survive the job that needed it.
 *
 * ── Logs ──
 *
 * One JSON object per line, carrying job id prefixes, stages and counts. Never
 * a CSV value, never the token. See log.mjs.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApi } from "./api.mjs";
import { describe, loadConfig, validateConfig } from "./config.mjs";
import * as indesignDriver from "./indesign.mjs";
import { log, shortJobId } from "./log.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * Shutdown is cooperative.
 *
 * A SIGINT in the middle of a render must not kill InDesign and leave a
 * half-written PDF: the flag is checked between jobs, so the current render
 * finishes and uploads first. A second signal is taken as "I mean it" and exits
 * immediately, because an operator who pressed Ctrl-C twice has decided.
 */
let stopping = false;
let forced = false;

function installSignalHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      if (stopping) {
        forced = true;
        log.warn("Second signal received; exiting now", { signal });
        process.exit(130);
      }
      stopping = true;
      log.info("Shutdown requested; will stop after the current job", { signal });
    });
  }
}

/**
 * Keep the lease alive while InDesign works.
 *
 * Returns a handle whose `lost` flag turns true if the server ever tells us the
 * job is no longer ours. The render is not interrupted — InDesign is already
 * running and killing it mid-export achieves nothing — but the result is
 * discarded rather than uploaded, so the worker that now owns the job is the
 * only one that finishes it.
 */
function startHeartbeat(api, jobId, config) {
  const state = { lost: false, stage: "Rendering in InDesign", progress: 25 };

  const timer = setInterval(async () => {
    try {
      const held = await api.heartbeat(jobId, {
        progress: state.progress,
        progressMessage: state.stage,
        rendering: true,
      });
      if (!held) {
        state.lost = true;
        log.warn("Lease lost; this job now belongs to another worker", { job: shortJobId(jobId) });
      }
    } catch (error) {
      /* A transient network failure is not proof the lease is gone. Keep
         rendering; the lease expiring server-side is the real signal. */
      log.warn("Heartbeat failed", { job: shortJobId(jobId), reason: error.message });
    }
  }, config.heartbeatMs);

  /* Never hold the process open on this alone. */
  timer.unref?.();

  return {
    state,
    stop() {
      clearInterval(timer);
    },
  };
}

/**
 * Render one claimed job, start to finish.
 *
 * Every exit path either completes or fails the job on the server, so a claimed
 * job is never abandoned silently — the only case that leaves it open is the
 * process dying outright, which the server's lease recovery handles.
 */
/*
 * `indesign` is injected so the tests can exercise this loop against every
 * outcome InDesign can produce — success, failure, timeout, an unusable PDF —
 * on machines where InDesign is not installed. Production always passes the
 * real driver, which is the default.
 */
async function processJob(api, config, claimed, indesign = indesignDriver) {
  const jobId = claimed.jobId;
  const short = shortJobId(jobId);
  log.info("Claimed job", { job: short, rows: claimed.rowCount, attempt: claimed.attempts });

  await mkdir(config.workDir, { recursive: true });
  const jobDir = await mkdtemp(path.join(config.workDir, "job-"));
  const heartbeat = startHeartbeat(api, jobId, config);

  try {
    const csvPath = path.join(jobDir, "input.csv");
    const pdfPath = path.join(jobDir, "church-directory-classic-proof.pdf");
    const resultPath = path.join(jobDir, "result.txt");

    const csv = await api.downloadInput(jobId);
    await writeFile(csvPath, csv);
    /* A byte count is safe to log; a line of its contents is not. */
    log.info("Input downloaded", { job: short, bytes: csv.length });

    heartbeat.state.stage = "Merging records in InDesign";
    heartbeat.state.progress = 45;

    const outcome = await indesign.runInDesignJob(
      config,
      { jobId, jobDir, csvPath, pdfPath, resultPath },
      {
        onStage: (stage) => {
          heartbeat.state.stage = stage;
        },
      }
    );

    if (outcome.detail) {
      /* Local diagnosis only. This can name paths, so it never becomes the
         customer-facing message. */
      log.info("InDesign reported detail", { job: short, detail: outcome.detail });
    }

    if (heartbeat.state.lost) {
      log.warn("Discarding a finished render because the lease was lost", { job: short });
      return;
    }

    if (outcome.status !== "completed") {
      const message = outcome.timedOut
        ? "The render took longer than the time allowed and was stopped."
        : outcome.message || "InDesign could not render this directory.";
      await api.fail(jobId, message);
      log.warn("Job failed in InDesign", { job: short, timedOut: outcome.timedOut });
      return;
    }

    const verified = await indesign.verifyPdf(outcome.pdfPath || pdfPath);
    if (!verified.ok) {
      await api.fail(jobId, `The render finished but ${verified.reason}.`);
      log.warn("Rejected an unusable PDF", { job: short, reason: verified.reason });
      return;
    }

    heartbeat.state.stage = "Uploading your PDF";
    heartbeat.state.progress = 90;

    /*
     * Confirm we still own the job immediately before uploading.
     *
     * The periodic heartbeat is not sufficient on its own: a render that
     * finishes between two ticks would upload having never re-checked, and a
     * render that overran its lease would upload over the work of the worker
     * that legitimately took the job. The server rejects that with a 409
     * anyway, but discovering it here means we neither send a large PDF that
     * will be thrown away nor log a spurious failure.
     */
    const stillOurs = await api
      .heartbeat(jobId, { progress: 90, progressMessage: "Uploading your PDF", rendering: true })
      .catch(() => true); /* A network blip is not proof the lease is gone. */

    if (!stillOurs || heartbeat.state.lost) {
      log.warn("Discarding a finished render because the lease was lost", { job: short });
      return;
    }

    /*
     * Completion happens on the server only after the upload succeeds — the
     * upload IS the completion call. A failure here leaves the job claimed, and
     * the lease expiring hands it to the next worker rather than marking a job
     * complete with nothing to download.
     */
    await api.complete(jobId, verified.bytes);
    log.info("Job completed", { job: short, bytes: verified.bytes.length });
  } catch (error) {
    log.error("Job errored", { job: short, reason: error.message });
    /* Best effort: if this also fails, the lease expires and the job is retried
       by whoever claims it next. */
    await api
      .fail(jobId, "The render worker could not complete this directory.")
      .catch((failure) => log.error("Could not report failure", { job: short, reason: failure.message }));
  } finally {
    heartbeat.stop();
    /* Unconditional. The customer's CSV and their rendered PDF leave this Mac
       whatever happened above. */
    await rm(jobDir, { recursive: true, force: true }).catch((error) =>
      log.error("Could not clean the job directory", { job: short, reason: error.message })
    );
  }
}

async function main() {
  const config = loadConfig();
  const problems = validateConfig(config);
  if (problems.length > 0) {
    log.error("Worker is not configured", { problems });
    process.exitCode = 1;
    return;
  }

  installSignalHandlers();
  const api = createApi(config);
  log.info("Worker started", describe(config));

  let backoffMs = config.pollMs;
  let sweepAt = 0;

  while (!stopping && !forced) {
    try {
      const claimed = await api.claim();

      if (claimed) {
        backoffMs = config.pollMs;
        await processJob(api, config, claimed);
        continue;
      }

      /* Idle. Run the retention sweep occasionally so a deployment without a
         cron still expires customer data on schedule. */
      if (Date.now() > sweepAt) {
        sweepAt = Date.now() + 15 * 60 * 1000;
        await api.cleanup();
      }

      backoffMs = config.pollMs;
      await sleep(config.pollMs);
    } catch (error) {
      /*
       * The API is unreachable, or refusing us. Back off exponentially rather
       * than hammering it — a worker left running through a deploy should not
       * generate a request storm.
       */
      log.error("Poll failed", { reason: error.message, status: error.status, retryInMs: backoffMs });
      await sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, config.maxBackoffMs);
    }
  }

  log.info("Worker stopped");
}

/* Only run the loop when executed directly, so the tests can import the
   helpers above without starting a poller. */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    log.error("Worker crashed", { reason: error.message });
    process.exit(1);
  });
}

export { processJob, startHeartbeat };
