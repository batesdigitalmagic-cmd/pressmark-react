# InDesign directory render pipeline

## Status

Stage 2 provides a tested website job queue and a development-only mock worker. It does **not** run InDesign in Vercel or in the browser and is not production-ready until a durable object-storage adapter is configured. The existing browser DOM proof renderer remains available for every flow other than the spreadsheet-based `directory-classic` production queue.

## Browser-to-worker flow

1. The customer chooses the unchanged `directory-classic` template, uploads a CSV, and grants permission to use it.
2. The browser posts multipart form data to `POST /api/render-jobs`.
3. The server enforces the size limit, accepts only `.csv`, decodes UTF-8, removes a BOM from the first header, rejects malformed/unsupported columns, requires `last_name` and `first_name`, sorts rows by last name then first name, and saves only a server-generated input key.
4. The browser receives a 256-bit random job ID, puts it in `?job=...`, and polls the status endpoint. The URL allows refresh/resume without storing customer data in the browser.
5. An authenticated Mac worker claims the next queued job, downloads its normalized input CSV, performs the local InDesign operation, and uploads either a PDF or a bounded failure message.
6. A completed customer job exposes a download URL. The high-entropy job ID is the customer bearer capability; internal object keys are never returned.

## API endpoints

| Endpoint | Method | Access | Purpose |
| --- | --- | --- | --- |
| `/api/render-jobs` | POST | Public, rate-limited | Validate CSV and create a queued job |
| `/api/render-jobs/:jobId` | GET | Unguessable job ID | Read sanitized job status |
| `/api/render-jobs/:jobId/download` | GET | Unguessable completed job ID | Download the PDF |
| `/api/render-jobs/worker/claim` | POST | Worker bearer token | Claim the next queued job |
| `/api/render-jobs/worker/:jobId/input` | GET | Worker bearer token | Download normalized CSV |
| `/api/render-jobs/worker/:jobId/result` | POST | Worker bearer token | Mark failed or upload completed PDF |

## Job states

- `uploaded` — validated input has been persisted but is not queued yet.
- `queued` — validated and waiting for a worker.
- `processing` — claimed by a worker.
- `completed` — output PDF stored and downloadable.
- `failed` — worker supplied a safe failure message.

Transitions implemented in Stage 2 are `uploaded → queued → processing → completed|failed`.

## Storage

The existing Upstash Redis/KV integration stores small license metadata. It is not an object store suitable for customer CSVs and PDFs. Zoho WorkDrive is used for quote-project folders, but there is no existing private object API or signed-download convention appropriate for this queue.

`lib/render-jobs/storage.js` is the adapter boundary. The current adapter stores metadata, `input.csv`, and `output.pdf` under `.pressmark-render-jobs/<jobId>/` for local development and tests. The directory is gitignored. It is enabled only with `PRESSMARK_RENDER_STORAGE=local` or `NODE_ENV=test`. Production fails closed with HTTP 503 instead of writing permanent jobs to Vercel's temporary filesystem.

A production adapter still needs durable private object storage, atomic job claiming, retention/deletion policy, encryption/access configuration, and deployment credentials. No provider or credentials are invented here.

## Worker authentication

Every worker endpoint requires `Authorization: Bearer <PRESSMARK_WORKER_TOKEN>`. The server reads this only from its environment and compares equal-length byte buffers with Node's constant-time comparison. The token is never returned or logged and must never use a `VITE_` prefix.

Generate a local token with `openssl rand -hex 32`, place it in the ignored `.env`, and use the same secret in the future Mac worker.

## Environment variables

- `PRESSMARK_WORKER_TOKEN` — required by worker endpoints.
- `PRESSMARK_RENDER_STORAGE=local` — explicitly enables local filesystem storage; never use this as a production durability solution.
- `PRESSMARK_RENDER_LOCAL_DIR` — optional local storage directory; defaults to `.pressmark-render-jobs`.
- `PRESSMARK_RENDER_MAX_CSV_BYTES` — optional upload limit; defaults to 2 MiB.
- `PRESSMARK_RENDER_API_URL` — mock-worker base URL; defaults to `http://127.0.0.1:3000`.

All are server/worker variables. None is referenced from client code.

## Local mock worker

The mock worker deliberately does not claim that InDesign ran. It calls the real claim/input/result APIs, copies `public/proof-templates/directory-classic/preview.pdf` as the output, and sets `mockOutput=true`; the status UI labels that download as a local sample.

With the local API running and `.env` configured:

```sh
npm run mock:directory-worker
```

## Future Mac/InDesign worker

The future worker will repeat the same authenticated protocol: claim, download `inputUrl`, save it as `church-directory-classic.csv` in a private working directory, invoke the existing `PressmarkDirectoryMerge.jsx` workflow against `church-directory-classic.indd`, then post the resulting `church-directory-classic-proof.pdf` to the result endpoint. It should post `status=failed` and a customer-safe message when InDesign or preflight fails.

The working JSX was not changed in Stage 2. Automating its file prompts and launching InDesign are intentionally deferred to the Mac-worker stage.

## Verification

`npm run test:render-jobs` covers CSV parsing/BOM normalization, header errors, alphabetical sorting, job creation, worker authentication, claim transitions, worker input access, completion/failure, pre-completion download denial, and completed PDF download. The full local flow uses the sample PDF only.

Production work still outstanding:

- Choose and configure durable object storage.
- Implement its storage adapter and atomic claim semantics.
- Define retention and customer deletion policies.
- Build the Mac process that controls the installed InDesign application.
- Exercise a genuine directory merge and PDF export on that Mac.
