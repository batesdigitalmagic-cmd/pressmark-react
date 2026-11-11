# Pressmark Studio platform (accounts + production dashboard)

Live at `/app` (hash-routed SPA, `app.html`), API at `/api/platform/*`
(`api/platform/[...path].js` → `lib/platform/api.js`).

## Decision: built on the existing stack, not Supabase
The repo already runs Vercel + Upstash Redis + Vercel Blob with a tested render
queue and Mac worker. Accounts, orgs and projects are stored in the same Redis
(`lib/platform/store.js`), files in the same private Blob. No new vendor, and
the whole thing is testable offline. Trade-off: no SQL, no database-enforced
row-level security. Tenancy is enforced in one place (`getProjectForOrg`) and
covered by tests. If you want Postgres/RLS, `store.js` is the only module to
replace; the proposed schema is below.

## Verified (2026-11-08)
`npm run test:platform` (15 tests) plus one real run: a local API, the real Mac
worker and **Adobe InDesign 21.6** rendered `church-directory-classic.indd` with the
20-row `church-directory-classic.csv` into a 3-page, 5.5 × 8.5 in PDF in ~12 s
(Producer: Adobe PDF Library 18.0). That run went register → verify → project → CSV
upload → submit → worker → proof → approve → validate → final download, and a second
business account got 404 on every project/proof/final route (anonymous: 401).

Lifecycle: draft → uploaded → queued → processing → proof_ready (awaiting approval)
→ approved → completed, plus revision_requested and failed. A completed job becomes a
numbered proof copied to project-owned storage; only the newest pending proof can be
approved or revised; approval is recorded server-side (who, when). Approval validates
the PDF (header, EOF, parseable, every page = template trim size) and only then stores a
final file; a failing PDF leaves the project `approved` with no final download.
The project is then locked; duplicate it to change anything.

## Not verified / not built
- **The browser UI has never been viewed.** The API and worker are tested end to end;
  the React dashboard and PDF viewer build and lint but no browser has opened them.
- **"Final print-ready" is limited.** The final file is the approved proof, exported by
  the script with the `[High Quality Print]` preset. Validation does NOT check font
  embedding, CMYK, bleed, image resolution or PDF/X; the UI says so.
- Production (Vercel/Upstash/Blob/Zoho email) has not been exercised; the run used the
  local storage emulation and the local dev API host.
- Photos: Directory Classic is text-only (the script and worker take CSV + colours).
  A photo directory needs a new template, script path and worker support.
- Billing, admin, support tickets, audit table, team invites, CSV column mapping.

## Setup
1. Vercel env: `PLATFORM_SESSION_SECRET` (32+ chars). Redis, Blob and
   `PRESSMARK_WORKER_TOKEN` as in `docs/indesign-render-pipeline.md`.
2. Verification/reset emails go through `lib/email.js` (Zoho Mail) — that path
   has never run against a live tenant. Until it does, users cannot verify and
   so cannot submit jobs.
3. Mac worker: unchanged (`worker/README.md`). Run one real directory through
   InDesign 2026 first; the merge script is still unexecuted against a live host.
4. Local: `PRESSMARK_RENDER_STORAGE=local PLATFORM_SESSION_SECRET=… node scripts/dev-api-server.mjs` + `npm run dev`.
   In local/test mode the register response includes the verification token.

## Proposed Postgres schema (if migrating)
organizations(id, name, contact…, branding jsonb) · users(id, email, password_hash, email_verified, session_version) ·
organization_members(org_id, user_id, role) · projects(id, org_id, name, template_id, brand_colors jsonb, status, csv jsonb) ·
project_assets(id, project_id, kind, path, bytes) · templates(id, category, config jsonb) ·
production_jobs(id, project_id, org_id, status, attempts, lease…) · job_events(job_id, at, event) ·
proofs(id, job_id, version, path) · approvals(id, proof_id, user_id, decision, notes, at) · final_files(id, proof_id, path, validated_at) ·
subscriptions(org_id, stripe ids, plan, status) · usage_records(org_id, job_id, period) · audit_logs(org_id, actor, action, at).
RLS: every table filtered by `org_id IN (select org_id from organization_members where user_id = auth.uid())`.

## Large PDFs (added 2026-11-10)

Vercel rejects any request body over 4.5 MB before a function runs, and caps a
*buffered* response at 4.5 MB. Both are handled:

- **Download:** proofs and finals are streamed from private Blob through
  `/api/platform/...` (`streamObject`), so the organisation check still runs first
  and the Blob URL never reaches a browser. `node-adapter.js` streams all responses.
- **Upload (worker to server):** a PDF over 4 MB no longer goes through `/result`.
  The worker POSTs `status=request_upload`; the server returns a client token
  scoped to that job's `output.pdf`, PDF content only, a size cap and 15 minutes.
  The worker uploads straight to Blob (multipart) and then POSTs
  `status=completed&uploaded=true`; the server inspects the stored object (size and
  `%PDF-` header) before completing, and deletes it if it is not a PDF. PDFs under
  4 MB use the original multipart path, so an older worker keeps working.

**Verified:** unit and integration tests (local storage), including a 10+ MB
download through the real Node handler and server-side verification of a >4.5 MB
direct upload. **Not verified:** token issuance and the multipart upload against
a real Blob store. That is exercised for the first time by the preview test.

## Preview isolation

`/api/platform` returns 503 on a Vercel preview unless `PRESSMARK_PREVIEW_ISOLATED=1`.
Set it only in the Preview environment, with Preview-scoped `KV_REST_API_*`,
`BLOB_READ_WRITE_TOKEN` and `PRESSMARK_WORKER_TOKEN`.

## Redis audit (2026-11-10, read-only)

The Redis in `.env.render` holds 20 keys: 3 `license:*`, 17 `sandbox:*`. The live
site depends on it. The platform adds only `plat:*` keys and never deletes or
flushes. Do not repoint `KV_REST_API_*` in Production at a different database.

## Separate Redis for the platform (2026-11-11)

Every existing consumer (licence store, render queue, health) reads
`KV_REST_API_*`; `UPSTASH_REDIS_REST_*` is only a fallback inside
`lib/license-store.js` when `KV_*` is absent. The platform therefore did NOT use the
second database until this change. `lib/platform/redis.js` now sends all
`plat:*` commands to `PLATFORM_REDIS_REST_URL` + `PLATFORM_REDIS_REST_TOKEN` when both
are set, and to the shared database otherwise. One set without the other is refused.
The render queue stays on the shared database (the worker and existing endpoints
read it there); a project stores only a job id, so no cross-database transaction
exists. `/api/health` reports the mode under `groups.platform.state` (presence
only). Not verified against a real Upstash database until the first live request.
