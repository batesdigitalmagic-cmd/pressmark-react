# Pressmark Instant Proof — technical notes

The automated publication-proof generator at `/instant-proof`.
**Phase 2 (template-driven, real CSV) is current.** See
[proof-templates.md](./proof-templates.md) for how to author a design template.

Its job is not to be a self-service publication builder. It is to let a
prospect hand over a small slice of real content and get back something
polished enough that hiring Pressmark for the complete publication feels like
the obvious next step.

---

## 1. Current demo behavior

**Nothing is uploaded.** Files selected or dropped by the visitor are held as
browser `File` objects in React state for the lifetime of the tab. There is no
network request, no `localStorage`, no `sessionStorage` of file data, and no
logging of filenames or field values.

### Phase 2 changed where the line sits

Phase 1 composed generic mockups from the customer's colors and photographs.
Phase 2 places **real parsed CSV content** — names, titles, grades, headlines,
body copy — into **real Pressmark design templates**, with photographs matched
to records by filename. What is still simulated is the *rendering*: pages are
composed as DOM from a template manifest, not exported from InDesign.

The processing step remains a **clearly labeled demonstration**. `ProofResult`
carries a `simulated: true` flag, and both `ProofProcessing` and `ProofResults`
render an explicit banner whenever it is set. The banner is driven by that flag
rather than hardcoded, so it disappears automatically the day a real renderer is
wired in — it cannot be left behind by mistake.

Within the demo, the line between measured and simulated is drawn deliberately:

| Real | Simulated |
| --- | --- |
| File counts, extensions, byte totals | The rendering step — DOM, not InDesign |
| Image pixel dimensions, measured via `Image.naturalWidth/Height` | Stage timing |
| Print-resolution warnings against 200/300 DPI at a 2in placed size | "Estimated automation time saved" — the **only** metric flagged `estimated: true` and badged in the UI |
| Full CSV parse: records, headers, values | |
| Column-mapping suggestions and the customer's confirmed mapping | |
| Data validation: missing required fields, duplicate IDs, duplicate sort order, rows missing photo filenames, unrecognized columns | |
| Photograph matching: exact, case-insensitive, unmatched, unused, duplicate references | |
| Records omitted from the limited sample | |

A visitor who uploads a 400px thumbnail is genuinely told it will not print
well, and one whose spreadsheet has two students sharing a record ID is told
that too. Those findings are real work and are the most credible thing on the
page.

Row *values* are used to compose the sample and are shown back to the customer
in the data step. They are never logged, never persisted, and never transmitted.

Every page carries a **Pressmark credit in its footer**, rendered by
`TemplateRenderer` as a `pointer-events: none` sibling of the page content, so
it survives the Phase 3 swap to InDesign rasters.

> This replaced the diagonal `Pressmark Sample Proof` watermark that covered
> each page through Phase 2. Be aware of what changed: the watermark made it
> impractical to pass a sample off as a finished piece, and a footer credit does
> not. If that protection is wanted back, put the marking in the footer text
> (`footerMark.text` on each template manifest) rather than reinstating an
> overlay.

---

## 2. Component architecture

The site is a **multi-page Vite build** (see `vite.config.js`); there is no
client-side router. Each route is an HTML entry with its own static `<head>`,
which is what makes the marketing pages indexable without SSR. Instant Proof
follows that existing convention rather than introducing a router:

```
instant-proof.html            static <head>, canonical, OG tags
  └── src/instant-proof.jsx   entry: initAnalytics() + createRoot
        └── src/pages/InstantProof.jsx   orchestrator
```

`vercel.json` sets `cleanUrls: true`, so the `.html` suffix never appears in the
URL and the route is served at `/instant-proof`.

```
src/instant-proof/
├── models.js            JSDoc typedefs, enums, factories, formatters
├── publications.js      PUBLICATION_CONFIGS (+ schemaIds), STYLE_DIRECTIONS, sizes, limits
├── styles.js            style objects + page CSS, built on src/blog/theme.js
├── quoteHandoff.js      sessionStorage handoff to the marketing quote form
├── csv/                 ── CONTENT SCHEMAS ──
│   ├── parseCsv.js          RFC4180 state-machine parser, no dependency
│   ├── schemas.js           the six content schemas: fields, required, aliases, roles
│   ├── columnMapping.js     suggestions (never auto-applied) + applyMapping
│   ├── analyzeRecords.js    data-quality validation + sortRecords
│   └── photoMatching.js     exact → case-insensitive filename reconciliation
├── templates/           ── DESIGN TEMPLATES ──
│   ├── registry.js          the manifest contract + lookup/filter/capacity helpers
│   ├── directory-classic.js
│   └── yearbook-modern.js
├── render/
│   ├── geometry.js           THE coordinate system: frame/pt/cellBox/pageBox
│   ├── TemplateRenderer.jsx  manifest → positioned DOM, cqw-scaled
│   ├── bindings.js           `field` expression → content
│   ├── fitting.js            truncate / clamp / shrink + image crop rules
│   ├── colors.js             color roles → the customer's brand colors
│   └── proofPlan.js          which records land on which page, what is omitted
├── rendering/
│   ├── proofRenderer.js      the interface + getProofRenderer() factory
│   └── mockProofRenderer.js  Phase 2 implementation
└── components/
    ├── ProofChrome.jsx             header + footer
    ├── ProofStepper.jsx            progress indicator
    ├── Fields.jsx                  TextField / SelectField / TextAreaField / ColorField
    ├── PublicationTypeSelector.jsx step 1
    ├── OrganizationForm.jsx        step 2
    ├── VisualDirectionSelector.jsx step 3 — wraps TemplateSelector
    ├── TemplateSelector.jsx        template cards + style-category filters
    ├── TemplatePreview.jsx         "Preview Design" dialog
    ├── ProofUploadPanel.jsx        step 4 — wraps CsvTemplatePanel
    ├── CsvTemplatePanel.jsx        CSV template downloads + column docs
    ├── ColumnMappingPanel.jsx      step 5a — header → field confirmation
    ├── DataReviewPanel.jsx         step 5b — parse results and issues
    ├── PhotoReconciliation.jsx     step 5c — unmatched records, manual picks
    ├── SubmissionReview.jsx        step 6
    ├── ProofProcessing.jsx         step 7
    ├── ProofResults.jsx            results composition
    ├── PublicationMockup.jsx       book presentation around TemplateRenderer
    ├── ProductionReport.jsx        metrics + warnings
    └── QuoteCTA.jsx                primary conversion block
```

### The three concepts, kept apart

| Concept | Answers | Lives in |
| --- | --- | --- |
| Publication configuration | *What is the customer making?* | `publications.js` |
| Content schema | *Which columns and assets does that need?* | `csv/schemas.js` |
| Design template | *How does it appear on the page?* | `templates/` |

A publication type names its recommended schemas (`schemaIds`); a design
template names the publication types and schemas it serves. Nothing is
hardcoded across the boundary, so a new publication type, a new schema and a new
design can each be added independently.

### Two modes, and what a proof actually requires

**Quick Photo Proof is the default.** A visitor can generate a proof having
entered *nothing* — no email, contact name, job title, phone, deadline or
organization. Validation requires only: a publication type, a design (which is
preselected), at least one supported photograph, and permission to use it.

| | Quick Photo Proof | Spreadsheet |
| --- | --- | --- |
| Steps | publication → photos → details → proof | publication → content → data → review → proof |
| Requires | a photograph + permission | a file + permission + a valid column mapping |
| Records | one synthesised per photograph (`photoProject.js`) | parsed CSV rows |

The organization step was **deleted**. Its fields are optional and live behind
an "Add organization details" disclosure; with no organization name the cover
reads `ORGANIZATION_FALLBACK`.

Quick Proof reuses the whole engine rather than forking it: each photograph
becomes one `people-directory`-shaped record whose `photo_filename` is the
asset's own name, so `photoMatching`, `planProof`, the schemas and every
template work unchanged.

### Email, and what is never consent

Email is requested **once**, and only when a visitor asks for something that
needs a reply:

| Action | Email | Subscribes? |
| --- | --- | --- |
| Generating a proof | never asked | never |
| Request a quote | required | **no** — unless a separate unticked box is ticked |
| Schedule a review | required | **no** — same box, same rule |
| Get publication tips | required | yes, that is the whole action |

`marketingOptIn` travels to the server as its own field so no integration can
infer consent from the presence of an address. **There is no subscription
backend** — `services/subscriptionService.js` reports `isConfigured: false` and
tells the visitor plainly rather than faking success. See that file for the
`POST /api/subscribe` contract still required.

### The wizard's step list is variable

The **data step appears only when a CSV has been parsed**, so the manual-content
path keeps Phase 1's shorter flow. Because of that, validation and navigation
key off **step IDs, not numeric indices** — an index-based switch would validate
the wrong step the moment a customer added or removed a spreadsheet.

`InstantProof.jsx` owns all wizard state, all validation and the renderer
lifecycle. Every step component below it is presentational — it receives a
value, an `onChange` and an `errors` object, and knows nothing about its
siblings.

### Reuse and bundle decisions

Design tokens come from `src/blog/theme.js` (`PALETTE`, `FONT_STACK`, `PAGE_X`),
re-exported through `styles.js` so this page shares the marketing site's bronze
accent, navy surfaces and Cormorant/Inter pairing rather than inventing a second
design system.

Header and footer are rebuilt in `ProofChrome.jsx` rather than imported from
`src/blog/components.jsx`, which pulls in `blogPosts.js` (~67 KB) purely to read
`BLOG_BASE`. This follows the precedent documented in `src/storefront/theme.js`.
Verified: the built `instantProof` chunk contains no reference to `blogPosts`.

`eslint.config.js` forbids `src/ → lib/` and `src/ → api/` imports because Vite
inlines anything `src/` touches into the browser bundle. Nothing here violates
that, and the Phase 2 notes below preserve it.

---

## 3. Data model

Defined as JSDoc typedefs in `models.js` — the repo is plain JavaScript, so
these give editor completion and translate one-for-one if the project ever
moves to TypeScript. Factories (`emptyProject()`, `emptyOrganization()`,
`idleStatus()`) guarantee shape at every construction site.

| Type | Role |
| --- | --- |
| `PublicationType` / `PublicationConfiguration` | One entry per publication kind; drives the selector, the upload slots, the review copy and the recommended schemas |
| `ContentSchema` / `SchemaField` | A CSV content family: canonical columns, required flags, header aliases, semantic roles |
| `DesignTemplate` / `TemplatePage` / `TemplateElement` | A Pressmark design as data: inch coordinates, font roles, color roles, repeaters, footer credit |
| `ProjectData` | The parsed spreadsheet: headers, raw rows, canonical records, mapping, overrides, analysis |
| `ContentRequirement` | A single upload slot: label, hint, accepted extensions, required flag |
| `OrganizationInformation` | Step 2 fields |
| `VisualDirection` | Style id, two brand colors, logo asset, design notes |
| `UploadedAsset` | Wraps a `File` with id, extension, size, kind and an optional object URL |
| `ProofProject` | The complete submission: type + organization + visual + assets + consent |
| `ProofJob` / `ProofJobStatus` | Job handle and its `{state, progress, stageId, message}` |
| `ProofResult` | `simulated`, pages, metrics, warnings, `footerMark`, `expiresAt` |
| `ProductionMetric` / `ProductionWarning` | Production summary rows |

`RENDER_STAGES` names the seven pipeline stages once. The mock walks the list to
drive its progress panel; a real renderer reports the same stage ids from the
server, so `ProofProcessing` needs no changes when the backend arrives.

### Adding a publication type

Add one object to `PUBLICATION_CONFIGS` in `publications.js`, including its
`schemaIds`. No component changes. The selector, the upload checklist, the CSV
download panel, the review summary and the page plan all read from it.

### Adding a design template

Write a manifest, drop the artwork in `public/proof-templates/<id>/`, and add it
to `DESIGN_TEMPLATES` in `templates/registry.js`. That is the whole wiring step —
see [proof-templates.md](./proof-templates.md).

### Adding a content schema

Add an object to `CONTENT_SCHEMAS` in `csv/schemas.js` and a matching CSV under
`public/csv-templates/`. Populate `aliases` generously: they are what let a
customer's existing spreadsheet map itself.

---

## 4. Replacing the mock renderer

Everything routes through one function:

```js
// src/instant-proof/rendering/proofRenderer.js
export function getProofRenderer() {
  return createMockProofRenderer();
}
```

Phase 2 becomes:

```js
export function getProofRenderer() {
  return import.meta.env.VITE_PROOF_RENDERER === "live"
    ? createHttpProofRenderer({ baseUrl: "/api/proof" })
    : createMockProofRenderer();
}
```

`VITE_PROOF_RENDERER` is a **feature flag, not a credential**. Adobe and storage
credentials stay server-side in `api/`, per the eslint rule above.

The new renderer implements the same six-member contract:

| Method | Phase 2 behavior |
| --- | --- |
| `createProofJob(project)` | `POST /api/proof/jobs` — persists the project, returns a job id |
| `uploadProofAssets(jobId, assets, onProgress)` | Request a signed PUT URL per asset from `/api/proof/upload-url`, then `PUT` each `File` **directly to object storage** so payloads never pass through a serverless function |
| `startProofRender(jobId)` | `POST /api/proof/jobs/:id/render` — enqueues background work, returns immediately |
| `getProofStatus(jobId)` | `GET /api/proof/jobs/:id/status` — polled at `POLL_MS`, returns the same `ProofJobStatus` shape |
| `getProofResult(jobId)` | `GET /api/proof/jobs/:id/result` — returns `ProofResult` with `simulated: false` and page raster URLs |

Polling is the primitive rather than callbacks or sockets: a real InDesign
render takes tens of seconds, browsers do not hold sockets reliably, and Vercel
functions are short-lived. The mock honours the same shape so the UI never
learns the difference.

In `PublicationMockup.jsx`, the page components are replaced by `<img>` elements
pointing at the returned rasters. The book presentation, the spine shadow and
the footer credit stay exactly as they are.

---

## 5. Required backend services

1. **Object storage** (S3 / R2 / Vercel Blob) — signed PUT for upload, signed
   GET for page rasters, and a **48-hour lifecycle expiry rule** on the proof
   prefix. The lifecycle rule is the enforcement mechanism for the retention
   promise made in the UI; do not rely on application code to delete.
2. **Job database** — jobs, project metadata, asset manifests, status,
   `expiresAt`. `lib/` already holds the patterns for a server-side store.
3. **Background worker** — a queue plus a longer-running compute target. Vercel
   serverless functions time out well before an InDesign render completes.
4. **Image preprocessing** — colour-space normalization (CMYK JPEGs are the
   common case the browser cannot read), resizing, and server-side DPI checks
   that supersede the browser measurements.
5. **Email** — `lib/email.js` already exists; send the proof link on completion.
6. **Rate limiting** — `lib/rate-limit.js` already exists. Proof generation is
   far more expensive than the quote form and needs a per-IP cap plus a
   file-count and total-byte ceiling enforced server-side, not just in the UI.
7. **Abuse controls** — the endpoint accepts arbitrary user files. Content-type
   sniffing (not extension trust), a virus scan, and a size cap are required
   before anything is stored.

---

## 6. Adobe InDesign API integration points

The mock's stage list maps directly onto the real pipeline:

| Stage | Real implementation |
| --- | --- |
| `analyze` | Server-side inspection of uploads: dimensions, colour space, DPI, CSV parse |
| `match` | Join CSV rows to image files by the `Photo File` column, then by filename heuristics |
| `hierarchy` | Build the merge manifest — sections, sort order, page breaks |
| `color` | Write the customer's brand colours into the template's swatches |
| `styles` | Apply paragraph, character and object styles from the chosen style direction's template |
| `resolution` | Preflight against the placed size in the actual layout |
| `render` | Execute the merge and export |

Two Adobe routes, both server-side only:

- **InDesign Data Merge API** — the primary path for directories, yearbooks and
  membership books. One `.indd` template per style direction × publication type,
  plus a generated CSV/XML data source. Highest fidelity to what Pressmark
  already produces by hand.
- **InDesign Custom Scripts API** — for layouts a data merge cannot express:
  event schedules, annual-report statistics treatments, commemorative timelines.
  ExtendScript/UXP scripts uploaded alongside the template.

Both are invoked from the background worker with credentials held in server
environment variables. Output: page rasters (PNG/JPEG) for the preview and a
PDF for download. **Any sample marking must be composited server-side** — a DOM
footer credit is a colophon, not a control over a real deliverable.

---

## 7. Privacy and deletion requirements

Promised in the UI: *"Your sample is private and automatically removed after
48 hours."*

**Phase 1 keeps this trivially** — nothing leaves the browser. State: React
only. Files: in-memory `File` objects. Previews: object URLs, revoked on removal
and on unmount. Persistence: none. `localStorage`: never used. Console: no
filenames, no field values, no file contents.

The one thing that crosses a boundary is the quote handoff in
`quoteHandoff.js` — name, email, phone, organization and the non-file answers,
written to **`sessionStorage`** so the marketing site's quote form can prefill.
Query parameters were rejected deliberately: personal information in a URL is
recorded in server logs, browser history and the analytics referrer.
`sessionStorage` is tab-scoped and cleared on close. `App.jsx` reads the key
once at module load and removes it immediately, and `takeQuoteHandoff()`
allow-lists the nine fields the form owns so a stale or tampered payload cannot
inject unexpected keys. **Uploaded files are never part of the handoff.**

Phase 2 must add:

- Signed, short-lived upload URLs scoped to a single job — never a shared
  bucket credential in the client.
- A storage lifecycle rule expiring the proof prefix at 48 hours, plus a
  scheduled job deleting the matching database rows. The lifecycle rule is the
  guarantee; the scheduled job is bookkeeping.
- Unguessable job ids (already the shape in the mock) and signed, expiring GET
  URLs for result pages. A proof containing member photographs must not be
  reachable by anyone holding the URL indefinitely.
- Consent capture recorded server-side with a timestamp. The checkbox in
  `SubmissionReview` is currently a client-side gate only.
- A retention note in `/privacy` covering proof submissions specifically.
- Access logging on proof reads, so an organization can be told who fetched
  their sample.

---

## 8. Verification

- `npm run lint` — clean.
- `npm run build` — succeeds; `instant-proof.html`, the `instantProof` chunk,
  six CSV templates and eight template artwork files are emitted.
- `npm run verify:proof` — **57 assertions** over the template geometry, text
  fitting, bindings, record planning and photo matching. Covers: elements inside
  their card, cards inside the page, no card crossing the fold, second-row
  clearance above folio and footer, name/title/address bands that cannot
  overlap, long names shrinking to a legibility floor then ellipsizing, missing
  fields collapsing without moving their neighbours, twelve records filling a
  spread in order, photographs staying with their own record, and positions
  remaining viewport-independent percentages.
- **39 further assertions** over the CSV pipeline (`scratchpad/phase2.mjs`), covering
  the required test matrix: standardized directory and yearbook CSVs, quoted
  commas, embedded newlines, CRLF, alternate column names, a missing required
  column, duplicate record IDs, duplicate sort orders, empty required values,
  exact and case-insensitive filename matching, unmatched records, unused
  uploads, duplicate references, manual overrides, 63-character names, no-CSV
  manual mode, and record-omission accounting.
- The mock renderer driven end to end against fixture files, twice in a row on
  the same instance (a second proof after completing the first), confirming
  real metrics and that the first job's result stays readable.

## 9. Privacy note specific to Phase 2

CSV **values** now flow through the app — they are parsed, mapped, validated,
shown back in the data step, and placed into the proof. They are held in React
state for the life of the tab and nowhere else:

- Not in `localStorage` or `sessionStorage`. The quote handoff carries only the
  organization form fields, never records or files.
- Not logged. No `console` call anywhere in the CSV, photo or render layers.
- Not sent to analytics. `src/instant-proof/analytics.js` routes every event
  through an allow-list of counts, booleans and Pressmark's own slugs; an email,
  name, filename or caption cannot reach GA even if a future caller passes one.
- Not transmitted. `parseCsvFile` uses `FileReader`; nothing issues a request.
- Cleared when the source CSV is removed, when "Start Another Proof" is used,
  and when the tab closes.

## 10. Known Phase 3 gaps

- **Server-side rendering.** The pages are DOM, not InDesign output. The
  manifest and `resolveBinding()` are designed to be consumed unchanged by a
  server renderer — that is the next major piece.
- **Real artwork.** Every file under `public/proof-templates/` is a generated
  placeholder stamped as such.
- **Two templates.** One directory, one yearbook. Event program, annual report,
  commemorative and sponsor designs have no dedicated template and currently
  fall back to the full list.
- **One schema per proof.** `ProjectData` holds a single parsed table, so an
  event program cannot yet combine a schedule *and* a sponsor sheet in one
  proof, even though both are offered for download.
- **No automated test runner** in the repository. The Phase 2 suite runs as a
  standalone Node script; every module it exercises is pure and would move into
  a real runner unchanged.
- Browser-measured DPI still assumes a fixed 2in placed size; a server preflight
  should use the actual placed size from the template manifest, which is now
  available.
- No server-side sample marking. The footer credit is a colophon rendered in the
  browser; a real deliverable needs the marking composited server-side.
