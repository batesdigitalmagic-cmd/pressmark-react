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

Create `worker/.env` (gitignored) or export these in the shell that starts the
worker.

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
cd worker
node health.mjs
```

It reports configuration, whether the template and script are readable, whether
InDesign is installed, and whether the API accepts this worker's token. It
prints the token's **length only** — never its value — so the output is safe to
paste into a support thread. Exit code `0` means ready, `1` means not.

`node health.mjs --json` gives the same report as one JSON object, for
monitoring.

---

## 5. Start it

```sh
cd worker
node pressmark-worker.mjs
```

Or `npm start` from inside `worker/`.

Logs are one JSON object per line: job id prefixes, stages, byte counts. Never a
CSV value, never a customer name, never the token.

`Ctrl-C` once asks it to stop after the current render finishes, so a job in
flight is not abandoned mid-export. `Ctrl-C` twice exits immediately.

---

## 6. Start automatically after a reboot

Create `~/Library/LaunchAgents/studio.pressmark.worker.plist`. Replace the two
paths and keep the file readable only by you, since it carries the token.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>studio.pressmark.worker</string>

  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOU/pressmark-react/worker/pressmark-worker.mjs</string>
  </array>

  <key>WorkingDirectory</key>
  <string>/Users/YOU/pressmark-react/worker</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PRESSMARK_API_URL</key>
    <string>https://your-domain</string>
    <key>PRESSMARK_WORKER_TOKEN</key>
    <string>PASTE_TOKEN_HERE</string>
    <key>PRESSMARK_INDD_TEMPLATE</key>
    <string>/Users/YOU/Pressmark/church-directory-classic.indd</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/Users/YOU/Library/Logs/pressmark-worker.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/YOU/Library/Logs/pressmark-worker.error.log</string>
</dict>
</plist>
```

Then:

```sh
chmod 600 ~/Library/LaunchAgents/studio.pressmark.worker.plist
launchctl load ~/Library/LaunchAgents/studio.pressmark.worker.plist   # start now + at login
launchctl unload ~/Library/LaunchAgents/studio.pressmark.worker.plist # stop
```

`which node` will tell you the correct node path — `/usr/local/bin/node` and
`/opt/homebrew/bin/node` are both common.

**The Mac must be logged in.** InDesign needs a GUI session; a LaunchAgent runs
at login, not at boot. Set Energy Saver to prevent sleep, or renders only happen
while you are at the machine.

---

## 7. Rotating `PRESSMARK_WORKER_TOKEN`

The token is a bearer credential for every worker endpoint. Rotate it if it may
have been exposed.

There is a brief window during rotation where the old token stops working before
the new one is in place, so do it when the queue is quiet.

1. Generate one: `openssl rand -hex 32`
2. Vercel → Project → Settings → Environment Variables → update
   `PRESSMARK_WORKER_TOKEN` → **redeploy** (env changes need a deploy).
3. Stop the worker (`Ctrl-C`, or `launchctl unload …`).
4. Update the value in `worker/.env` or in the plist.
5. Start the worker and confirm with `node health.mjs` — `API authorized` must
   read `ok`.

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
