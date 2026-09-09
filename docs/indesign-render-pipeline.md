# InDesign directory render pipeline

## Status

**Production-capable, pending two Vercel resources and one manual InDesign verification.**

The free browser proof is independent of everything below. `directory-classic`
renders its proof in the customer's tab; this pipeline produces the optional
production PDF offered underneath it. A stopped worker or an unconfigured store
degrades the PDF offer, never the proof.

What is built:

- Job state, the queue and worker leases in **Upstash Redis** (already
  provisioned for licences — no new database).
- Customer CSVs and rendered PDFs in **Vercel Blob**, `access: "private"`,
  streamed only through token-checked API routes. No blob URL ever reaches a
  browser.
- A real lifecycle with atomic single-worker claim, lease renewal, crash
  recovery, bounded retries and idempotent completion.
- A standalone Mac worker (`worker/`) that drives InDesign 2026 through the
  existing `PressmarkDirectoryMerge.jsx`.
- Retention: Redis expires metadata; `POST /api/render-jobs/cleanup` deletes the
  objects, which have no TTL of their own.

What still needs a human:

1. Create the Vercel Blob store and set `BLOB_READ_WRITE_TOKEN`.
2. Confirm `PRESSMARK_WORKER_TOKEN` is set in Vercel and in the worker.
3. Run one directory through InDesign 2026 manually. The merge script's DOM
   calls have never been executed against a 2026 host; nothing in the automated
   suite can verify that.

Until step 1 is done, `/api/render-jobs` answers **503 naming the missing
resource** rather than failing obscurely.

## Storage

Two stores, chosen for two different jobs.

| | Holds | Why |
| --- | --- | --- |
| Upstash Redis | job records, the queue, leases, the retention index | Atomic `SET NX` is what makes a single-worker claim correct. Already provisioned; reached over REST so it works on Edge and Node. |
| Vercel Blob | the normalized CSV, the rendered PDF | Private object storage with authenticated reads. Blobs are streamed through the API, never linked. |

`lib/render-jobs/kv.js` routes Redis commands to Upstash in production and to an
in-process emulation locally, so **the same lifecycle code runs in both** — the
tests exercise the real claim and lease logic rather than a stand-in.
`lib/render-jobs/blob.js` does the same for objects, writing to a gitignored
directory when `PRESSMARK_RENDER_STORAGE=local`.

Local filesystem storage is a development convenience only. A Vercel function's
filesystem is ephemeral and per-instance, which is why the previous adapter
failed closed in production and the flow could never finish.

### Retention

Job records carry a Redis TTL (`PRESSMARK_RENDER_RETENTION_SECONDS`, default 48
hours, matching what the results page promises). Blob objects have **no TTL**, so
`POST /api/render-jobs/cleanup` walks the retention index and deletes them.

The index is separate from the active set deliberately: a job leaves the active
set the moment it completes, and a completed job is precisely the one still
holding a PDF. A sweep driven by the active set would have collected nothing
that mattered.

The input CSV is deleted as soon as a render succeeds — the customer's contact
details are the sensitive half of this pipeline and the finished PDF no longer
needs them.

Drive cleanup from a Vercel Cron:

```json
{ "crons": [{ "path": "/api/render-jobs/cleanup", "schedule": "0 * * * *" }] }
```

The worker also calls it while idle, so a deployment without a cron still
expires data as long as the Mac is running.

## The two CSV schemas

The browser and the worker deliberately speak different schemas:

| | Columns | Required | Used for |
| --- | --- | --- | --- |
| `src/instant-proof/csv/schemas.js` (`people-directory`) | 17 | `record_id`, `display_name` | Mapping UI, photo matching, the on-screen proof |
| `lib/render-jobs/csv.js` | 8 | `last_name`, `first_name` | What the InDesign worker receives |

These used to disagree silently, and the `pressmark-people-directory.csv` template this site offers for download was rejected outright by the endpoint it feeds (`Unsupported headers: record_id, display_name, ...`).

`src/instant-proof/csv/directoryExport.js` now projects the rich record set down to the worker's eight columns immediately before submission — names split from `display_name` when necessary, street and locality rejoined into the single `address` column, and empty optional columns omitted. The customer's original file is never posted. `verify:proof` asserts the mirrored header list still matches `lib/render-jobs/csv.js` and runs the real server validator over the projected output.

## Browser-to-worker flow

1. The customer chooses `directory-classic`, uploads a CSV, confirms the column mapping, and grants permission to use it.
2. The proof is composed **in the browser** and shown. Under it, "Request the production PDF" is offered.
3. Only if the customer asks: the browser projects the mapped records to the worker schema and posts multipart form data to `POST /api/render-jobs`.
4. The server enforces the size limit, accepts only `.csv`, decodes UTF-8, removes a BOM from the first header, rejects malformed/unsupported columns, requires `last_name` and `first_name`, sorts rows by last name then first name, and saves only a server-generated input key.
5. The browser receives a 256-bit random job ID, puts it in `?job=...`, and polls the status endpoint. The URL allows refresh/resume without storing customer data in the browser.
6. An authenticated Mac worker claims the next queued job, downloads its normalized input CSV, performs the local InDesign operation, and uploads either a PDF or a bounded failure message.
7. A completed customer job exposes a download URL. The high-entropy job ID is the customer bearer capability; internal object keys are never returned.

## API endpoints

| Endpoint | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/render-jobs` | POST | Public, rate-limited (5/hour/IP) | Validate + normalize CSV, store it privately, queue a job |
| `/api/render-jobs/:jobId` | GET | Unguessable job ID | Sanitized customer status |
| `/api/render-jobs/:jobId/download` | GET | Unguessable completed job ID | Stream the PDF (rate-limited 60/hour/IP) |
| `/api/render-jobs/cleanup` | POST | Worker bearer token | Lease recovery + retention sweep |
| `/api/render-jobs/worker/claim` | POST | Worker bearer token | Atomically claim one queued job |
| `/api/render-jobs/worker/:jobId/input` | GET | Worker bearer token | Stream the normalized CSV |
| `/api/render-jobs/worker/:jobId/heartbeat` | POST | Worker bearer token | Renew the lease, report progress |
| `/api/render-jobs/worker/:jobId/result` | POST | Worker bearer token | Upload the PDF, or report failure |

The customer view (`publicJob`) deliberately omits `workerId`, `leaseExpiresAt`,
`heartbeatAt`, `attempts` and both blob paths. A job id is a bearer capability —
whoever holds the URL sees that payload, so it carries nothing we would not hand
to a stranger who guessed 256 bits.

## Job states

```
queued ──claim──> claimed ──heartbeat──> rendering ──result──> completed
   ▲                  │                      │                     
   └──── retry ───────┴──────────────────────┴────────────> failed
```

- `queued` — validated, stored, waiting for a worker.
- `claimed` — a worker holds the lease. Attempt count incremented.
- `rendering` — InDesign is running; progress is being reported.
- `completed` — PDF stored and downloadable.
- `failed` — terminal, with a bounded customer-safe message.

`claimed` and `rendering` both surface to the customer as the single stage
`rendering`; flickering between two labels tells the person waiting nothing.

A failure with attempts remaining returns the job to `queued` rather than
failing it. After `PRESSMARK_RENDER_MAX_ATTEMPTS` (default 3) it fails for good.

### The lease

The lease is its own Redis key — `renderjob:claim:<id>`, value = worker id, with
a TTL — not a field inside the job JSON. Read-modify-write on a JSON blob is not
atomic and two workers can interleave and both believe they won. `SET … NX EX`
either creates the key or fails, in one round trip.

Ownership is re-proved on every later write by comparing that key, which is what
makes crash recovery safe: a dead worker's key simply expires, and the sweep can
requeue the job knowing nobody holds it. Renew-if-mine and release-if-mine are
tiny Lua scripts so the compare and the act cannot be separated; they compare
strings only, with no JSON parsing in Lua.

## Worker authentication

Every worker endpoint requires `Authorization: Bearer <PRESSMARK_WORKER_TOKEN>`,
compared with Node's constant-time comparison on equal-length buffers. The token
is read only from the server environment, is never returned, never logged, and
must never carry a `VITE_` prefix — Vite inlines anything `src/` reads into the
browser bundle.

Generate with `openssl rand -hex 32`. Rotation is documented in
`worker/README.md`.

## Environment variables

Site (Vercel):

| Name | Required | Purpose |
| --- | --- | --- |
| `PRESSMARK_WORKER_TOKEN` | yes | Shared secret for worker endpoints |
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob — private CSV/PDF storage |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | yes | Upstash Redis — job state (already set for licences) |
| `PRESSMARK_RENDER_MAX_CSV_BYTES` | no | Default 2 MiB |
| `PRESSMARK_RENDER_MAX_ROWS` | no | Default 5000 |
| `PRESSMARK_RENDER_MAX_PDF_BYTES` | no | Default 100 MiB |
| `PRESSMARK_RENDER_LEASE_SECONDS` | no | Default 120 |
| `PRESSMARK_RENDER_RETENTION_SECONDS` | no | Default 172800 (48 h) |
| `PRESSMARK_RENDER_MAX_ATTEMPTS` | no | Default 3 |
| `PRESSMARK_RENDER_STORAGE` / `PRESSMARK_RENDER_LOCAL_DIR` | no | **Local development only** |

Worker (the Mac): see `worker/README.md`. None of them is referenced from client
code.

## The Mac worker

`worker/` is a standalone Node program. It polls, claims one job at a time,
downloads the CSV into a per-job temporary directory, writes a handoff file,
drives InDesign through `osascript`, verifies the PDF, uploads it, and deletes
the working directory in a `finally` block — on success, failure, timeout and
shutdown alike.

Setup, the start command, launchd configuration, health checks and token
rotation are all in `worker/README.md`.

### How the job reaches the JSX

The worker writes `~/Library/Application Support/Pressmark/current-render-job.txt`
as `key=value` lines, then asks InDesign to run the script.

A file rather than `do script … with arguments` because the script body is
wrapped in an IIFE: the global `arguments` array InDesign populates is shadowed
there by the function's own `arguments`, so reading it would silently yield the
wrong value. `key=value` rather than JSON because the ES3 ExtendScript host has
no `JSON` object.

The script **consumes** the handoff — deleting it before doing any work — so a
later manual double-click can never inherit a stale job, and a file older than
30 minutes is ignored for the same reason.

The script writes its outcome to a result file as its last action. That file is
the authority: present with `status=completed` means the render worked, present
with `status=failed` says why, and absent means InDesign died mid-run. That is
what lets the worker distinguish a genuine render failure from a crash, and
retry only where retrying makes sense.

`PressmarkDirectoryMerge.jsx` keeps its manual mode byte-for-byte: double-clicked
from the Scripts panel with no handoff present, it still prompts for the
template, the CSV and an output folder, and still leaves the merged document
open for inspection. Job mode closes it, because an unattended worker would
otherwise accumulate documents until InDesign ran out of memory.

## Local mock worker

The mock worker deliberately does not claim that InDesign ran. It calls the real
claim/input/result APIs, copies
`public/proof-templates/directory-classic/preview.pdf` as the output, and sets
`mockOutput=true`. The UI labels that download **"Sample output: this file is the
Pressmark sample preview, not an InDesign render of your directory."**

Mock output is never the default: `mockOutput` is false unless a caller
explicitly sets it, and the real worker never does.

```sh
npm run mock:directory-worker
```

## Verification

```sh
npm run test:render-jobs          # lifecycle, storage, auth, retention
npm run verify:proof              # the whole Instant Proof pipeline
cd worker && node --test tests/*.test.mjs
```

`test:render-jobs` covers private CSV/PDF storage, atomic single-worker claim
(including a five-way concurrent race), lease renewal and refusal, expired-lease
recovery, attempt exhaustion, unauthorized worker requests on every endpoint,
invalid template ids and CSVs, duplicate completion, PDF signature rejection,
failure-and-retry, protected download gating, and retention cleanup.

The worker suite covers configuration validation, log redaction, the handoff
contract, PDF verification, and the job loop against every InDesign outcome —
success, reported failure, timeout, unusable PDF, lost lease, and a mid-job
crash — with InDesign injected so it runs anywhere.

### Not covered by any automated test

**The InDesign DOM behaviour itself.** No test in this repository launches
InDesign 2026. `PressmarkDirectoryMerge.jsx` has never been executed against a
2026 host, and its data-merge and PDF-export calls are unverified there. One
manual run is required before this pipeline is trusted with a customer's
directory.
