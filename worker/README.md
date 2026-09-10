# Pressmark Directory render worker

A small Node program that runs continuously on your Mac. It claims Directory
Classic render jobs from the Pressmark site, renders them through Adobe InDesign
2026 using `PressmarkDirectoryMerge.jsx`, and uploads the finished PDF.

It is **not** part of the website and never runs on Vercel. The site queues work;
this drains the queue.

> The free browser proof does not depend on this worker. If the worker is
> stopped, customers still get their on-screen proof — only the optional
> production PDF waits in the queue.

---

## 1. What must exist first

| Requirement | Notes |
| --- | --- |
| macOS with Adobe InDesign 2026 installed | The worker launches it via AppleScript. |
| Node 20 or newer | `node --version` |
| `church-directory-classic.indd` | The production template, somewhere on this Mac. Not in the repo — it is a binary design asset. |
| Vercel Blob store connected to the project | Provides `BLOB_READ_WRITE_TOKEN`. |
| Upstash Redis connected to the project | Provides `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Already used for licences. |
| `PRESSMARK_WORKER_TOKEN` set in Vercel | The same value goes in this worker's environment. |

The template must **not** be open in InDesign while the worker runs. The script
refuses to merge from an open document so it cannot discard unsaved work.

---

## 2. Install the merge script into InDesign

Follow `scripts/indesign/README.md`. The worker drives the same file that a
manual run uses — there is one script, with two modes.

---

## 3. Configure

Two gitignored files at the repository root, loaded together at launch:

| File | Holds | Why split |
| --- | --- | --- |
| `.env.worker` | paths and the API URL | No secret, so it is safe to read, diff and paste |
| `.env.local` | `PRESSMARK_WORKER_TOKEN` | Already where this machine's secrets live — one copy, one place to rotate |

`.env.local` is loaded **last**, so its values win.

| Variable | Required | Meaning |
| --- | --- | --- |
| `PRESSMARK_API_URL` | yes | `https://your-domain` in production, `http://127.0.0.1:3000` locally. No trailing slash needed. |
| `PRESSMARK_WORKER_TOKEN` | yes | The shared secret. Must match Vercel exactly. |
| `PRESSMARK_INDD_TEMPLATE` | yes | Absolute path to `church-directory-classic.indd`. |
| `PRESSMARK_JSX_SCRIPT` | no | Absolute path to `PressmarkDirectoryMerge.jsx`. Defaults to `../scripts/indesign/` relative to the worker. |
| `PRESSMARK_WORKER_ID` | no | Names this Mac in job records and logs. Defaults to `hostname-pid`. |
| `PRESSMARK_INDESIGN_BUNDLE_ID` | no | Default `com.adobe.InDesign`. |
| `PRESSMARK_WORKER_POLL_MS` | no | Idle poll interval, default `5000`. |
| `PRESSMARK_RENDER_TIMEOUT_MS` | no | Longest single render, default `900000` (15 min). |
| `PRESSMARK_WORKER_HEARTBEAT_MS` | no | Lease renewal interval, default `30000`. Must stay well under the server's 120 s lease. |
| `PRESSMARK_WORKER_WORK_DIR` | no | Per-job scratch. Defaults to a directory under the system temp dir. |

**Never** give any of these a `VITE_` prefix and never put the token in the
website's client code. Vite inlines anything `src/` reads into the browser
bundle.

---

## 4. Check the setup before starting

```sh
node --env-file=.env.worker --env-file=.env.local worker/health.mjs
```

It reports configuration, whether the template and script are readable, whether
InDesign is installed, whether the API accepts this worker's token, and how deep
the queue is.

Neither the token **nor its length** is printed — a length narrows a brute force
and ends up in screenshots — so the output is safe to paste into a support
thread. Exit code `0` means ready, `1` means not.

`--json` gives the same report as one object, for monitoring.

A `FAIL` on `API authorized` immediately after a redeploy is usually
propagation, not a wrong value. Wait a minute and run it again.

---

## 5. Start it

```sh
node --env-file=.env.worker --env-file=.env.local worker/pressmark-worker.mjs
```

Or `./worker/start-worker.sh`, which resolves the paths itself and is what
launchd runs.

Logs are one JSON object per line: job id prefixes, stages, byte counts. Never a
CSV value, never a customer name, never the token.

`Ctrl-C` once asks it to stop after the current render finishes, so a job in
flight is not abandoned mid-export. `Ctrl-C` twice exits immediately.

---

## 6. Start automatically after login

```sh
./worker/install-launchd.sh install
```

That writes `~/Library/LaunchAgents/studio.pressmark.worker.plist`, loads it,
and starts the worker immediately. It will start again at every login.

```sh
./worker/install-launchd.sh status      # loaded? pid? last 15 log lines
./worker/install-launchd.sh uninstall   # stop it and remove the agent
```

### No secret goes in the plist

The obvious launchd setup puts `PRESSMARK_WORKER_TOKEN` in the plist's
`EnvironmentVariables` dictionary. Don't. That writes the token into a file in
`~/Library/LaunchAgents` which is world-readable by default, lands in Time
Machine backups, and is easy to paste into a support thread by accident.

The generated plist contains **paths only**. `worker/start-worker.sh` loads
`.env.worker` and `.env.local` at launch, so there is exactly one copy of the
token on the machine, in a file that is already gitignored.

### A LaunchAgent, not a LaunchDaemon

Deliberate. InDesign needs a logged-in GUI session; a daemon starting at boot
would have no window server and every render would fail.

**Consequence: the Mac must be logged in for renders to happen.** Set Energy
Saver to prevent sleep, or PDFs are only produced while you are at the machine.
Customers' free browser proofs are unaffected either way — only the production
PDF waits.

### Logs

```
~/Library/Logs/pressmark-worker.log
~/Library/Logs/pressmark-worker.error.log
```

One JSON object per line. They are not rotated automatically; if the worker runs
for months, truncate them or add a `newsyslog.d` rule.

### Restart behaviour

`KeepAlive` restarts the worker if it exits unexpectedly, with a 30-second
`ThrottleInterval` so a persistent problem does not hot-loop. A configuration
error (missing node, missing env file) exits 78 and launchd will **not** respawn
it — check `install-launchd.sh status` and the error log.

### What the log tells you

While idle the worker reports the queue whenever the depth changes, and at least
every five minutes:

```json
{"level":"info","message":"Queue","waiting":2,"heldByWorker":0,"holdingFiles":2}
```

Counts only — the status endpoint returns three numbers and no job data, because
a filename routinely identifies the customer.

A rejected token is called out by name, since it is the most likely failure
after a rotation or redeploy:

```json
{"level":"error","message":"API rejected this worker's token","status":401,
 "consecutiveFailures":3,
 "hint":"PRESSMARK_WORKER_TOKEN does not match the deployment; check both, and allow a minute after a redeploy"}
```

Repeated failures are counted rather than repeated verbatim, and a single
`Recovered` line is logged when the API comes back.

### One job at a time

The loop awaits each render to completion before polling again. InDesign drives
one document at a time and two concurrent renders would fight over the same
template and the same application state. Run **one worker per Mac** — throughput
comes from the queue, not from concurrency here.

## 7. Rotating `PRESSMARK_WORKER_TOKEN`

The token is a bearer credential for every worker endpoint. Rotate it if it may
have been exposed.

There is a brief window during rotation where the old token stops working before
the new one is in place, so do it when the queue is quiet.

1. Generate one: `openssl rand -hex 32`
2. Vercel → Project → Settings → Environment Variables → update
   `PRESSMARK_WORKER_TOKEN` → **redeploy** (env changes need a deploy).
3. Stop the worker (`Ctrl-C`, or `./worker/install-launchd.sh uninstall`).
4. Update `PRESSMARK_WORKER_TOKEN` in `.env.local`. Nowhere else — the plist
   contains no secret.
5. Start the worker and confirm:
   `node --env-file=.env.worker --env-file=.env.local worker/health.mjs`
   — `API authorized` must read `ok`. Allow a minute after the redeploy before
   trusting a `FAIL`.

Any job mid-render when you stop the worker returns to the queue automatically
once its lease expires (about two minutes) and is retried.

Never commit the token, never paste it into an issue, and never read it back out
of `.env.local`.

---

## 8. How a job flows

```
site: POST /api/render-jobs        CSV validated, normalized, stored privately
                                   job created: queued
worker: POST /worker/claim         atomic SET NX takes the lease -> claimed
worker: GET  /worker/:id/input     CSV downloaded to a per-job temp directory
worker: writes the handoff file    ~/Library/Application Support/Pressmark/
worker: osascript -> InDesign      PressmarkDirectoryMerge.jsx runs in job mode
        POST /worker/:id/heartbeat every 30 s: renews the lease -> rendering
        JSX writes result.txt      status=completed|failed
worker: verifies the PDF           exists, non-trivial, begins %PDF-
worker: POST /worker/:id/result    uploads the PDF -> completed
site:   GET  /api/render-jobs/:id/download   streamed, private, never a blob URL
```

If the worker dies at any point, its lease expires and the job is offered to the
next worker. After three attempts it is failed with a message the customer can
read.

---

## 9. Troubleshooting

**`health.mjs` says `API authorized FAIL`** — the token differs between the
worker and Vercel, or Vercel has not been redeployed since it changed.

**`API authorized` reports "render storage is not configured"** — the token is
right, but the deployment is missing the Blob store or Upstash. The message
names which.

**Jobs stay `queued`** — nothing is claiming them. Check the worker is running
and that `PRESSMARK_API_URL` points at the same deployment the customer used.

**Jobs keep failing after three attempts** — read
`PressmarkDirectoryMerge.log`, written into the job's temp directory. Note the
directory is deleted when the job ends; to keep one for inspection, set
`PRESSMARK_WORKER_WORK_DIR` somewhere you control and stop the worker before it
cleans up, or reproduce the CSV manually through the Scripts panel.

**A render hangs** — InDesign is probably showing a modal dialog (missing fonts,
missing links). The worker times out after 15 minutes and fails the job. Open
InDesign and run the script manually once to see the dialog.

**Two workers on one Mac** — don't. InDesign drives one document at a time. Run
one worker per machine.

---

## 10. Tests

```sh
cd worker
node --test tests/*.test.mjs
```

These do not launch InDesign. The InDesign call is injected, so the job loop is
exercised against every outcome it can produce — success, reported failure,
timeout, an unusable PDF, and a lost lease — on any machine. The DOM behaviour
of the merge itself still needs one manual run in InDesign 2026.
