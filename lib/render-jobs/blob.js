/*
 * Private object storage for customer CSVs and rendered PDFs.
 *
 * SERVER ONLY. Never import from src/.
 *
 * ── Everything here is private ──
 *
 * Every put and every get passes `access: "private"`, so an object is reachable
 * only by a caller holding BLOB_READ_WRITE_TOKEN. Nothing in this module ever
 * returns a blob URL to a browser: the customer's download is streamed back
 * through /api/render-jobs/:jobId/download, and the worker's input through
 * /api/render-jobs/worker/:jobId/input. The blob URL exists only in server code.
 *
 * That is deliberate. A signed URL handed to the browser would be a second,
 * longer-lived capability we could not revoke when the job expired; a streamed
 * response is bounded by the request that asked for it.
 *
 * ── Paths ──
 *
 *   render-jobs/<jobId>/input.csv
 *   render-jobs/<jobId>/output.pdf
 *
 * The job id is 256 bits of randomness, so paths are not enumerable — and
 * `addRandomSuffix: false` keeps them derivable by US, which is what lets the
 * worker and the download endpoint find an object without storing a URL we
 * would then have to keep in sync.
 *
 * ── Local mode ──
 *
 * With PRESSMARK_RENDER_STORAGE=local (or under the test suite) the same
 * functions read and write a gitignored directory instead. That is a
 * development convenience, never a production option: a Vercel function's
 * filesystem is ephemeral and per-instance, which is the whole reason this
 * module exists.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { StorageUnavailableError } from "./storage-errors.js";

const usingLocal = () =>
  process.env.PRESSMARK_RENDER_STORAGE === "local" || process.env.NODE_ENV === "test";

const token = () => process.env.BLOB_READ_WRITE_TOKEN || "";

export function blobConfigured() {
  return usingLocal() || Boolean(token());
}

function requireBlob() {
  if (!blobConfigured()) {
    throw new StorageUnavailableError(
      "Directory rendering needs private file storage. Create a Vercel Blob store " +
        "(Vercel → Storage → Blob) and set BLOB_READ_WRITE_TOKEN."
    );
  }
}

export const inputCsvPath = (jobId) => `render-jobs/${jobId}/input.csv`;
export const outputPdfPath = (jobId) => `render-jobs/${jobId}/output.pdf`;

/* One place for the options every call must carry, so a future call cannot
   quietly omit `access` and publish a customer's directory. */
const options = () => ({ access: "private", token: token() });

const localRoot = () =>
  path.resolve(process.env.PRESSMARK_RENDER_LOCAL_DIR || ".pressmark-render-jobs");
const localFile = (pathname) => path.join(localRoot(), pathname);

async function writeLocal(pathname, bytes) {
  const file = localFile(pathname);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return pathname;
}

async function readLocal(pathname) {
  try {
    return new Uint8Array(await readFile(localFile(pathname)));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function removeLocal(pathname) {
  await rm(localFile(pathname), { force: true });
}

async function writeObject(pathname, bytes, contentType) {
  requireBlob();
  if (usingLocal()) return writeLocal(pathname, bytes);
  const result = await put(pathname, bytes, {
    ...options(),
    contentType,
    /* Derivable from the job id, and a retried render rewrites its own input. */
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
  return result.pathname;
}

/*
 * Read an object back as bytes.
 *
 * `useCache: false` because these are read a handful of times at most, and a
 * stale CDN copy of a retried render would hand the worker the previous
 * attempt's input. Returns null when the object is absent, so a caller can tell
 * "expired" from "broken".
 */
async function readObject(pathname) {
  requireBlob();
  if (usingLocal()) return readLocal(pathname);

  const found = await get(pathname, { ...options(), useCache: false }).catch((error) => {
    /* Some SDK versions throw rather than returning null for a missing object;
       only a genuine absence becomes null, everything else still raises. */
    if (/not found|404/i.test(error?.message || "")) return null;
    throw error;
  });
  if (!found || found.statusCode !== 200 || !found.stream) return null;
  return new Uint8Array(await new Response(found.stream).arrayBuffer());
}

async function removeObject(pathname) {
  requireBlob();
  if (usingLocal()) return removeLocal(pathname);
  await del(pathname, options()).catch((error) => {
    if (/not found|404/i.test(error?.message || "")) return undefined;
    throw error;
  });
  return undefined;
}

export const putInputCsv = (jobId, bytes) =>
  writeObject(inputCsvPath(jobId), bytes, "text/csv; charset=utf-8");

export const putOutputPdf = (jobId, bytes) =>
  writeObject(outputPdfPath(jobId), bytes, "application/pdf");

export const readInputCsv = (jobId) => readObject(inputCsvPath(jobId));
export const readOutputPdf = (jobId) => readObject(outputPdfPath(jobId));

/**
 * Delete both of a job's objects.
 *
 * Blob storage has no TTL of its own — Redis expires the metadata on schedule
 * but the files would sit there for ever, so retention is only real if
 * something calls this. api/render-jobs/cleanup.js is what does.
 *
 * Deleting an object that is already gone is not an error; retention has to be
 * safe to run twice.
 */
export async function deleteJobObjects(jobId) {
  await Promise.all([removeObject(inputCsvPath(jobId)), removeObject(outputPdfPath(jobId))]);
}

/**
 * Drop the input CSV once a render has succeeded.
 *
 * The customer's contact details are the sensitive half of this pipeline and
 * the finished PDF no longer depends on them. Keeping the CSV for the rest of
 * the retention window would be storing personal data we have no further use
 * for.
 */
export const deleteInputCsv = (jobId) => removeObject(inputCsvPath(jobId));
