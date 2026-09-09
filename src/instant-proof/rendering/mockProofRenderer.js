/*
 * MockProofRenderer — the Phase 1 implementation of the ProofRenderer contract.
 *
 * What is real here:
 *   • File counts, byte totals and per-type breakdowns come from the actual
 *     files the visitor added.
 *   • Image pixel dimensions are measured in the browser, and the resolution
 *     warnings are computed from those real measurements against a 300 DPI
 *     print target. A visitor who uploads a 400px thumbnail is told so, and
 *     that is a genuinely useful answer.
 *   • CSV record counts are read by counting non-empty lines in the file.
 *
 *   • CSV records are parsed for real (csv/parseCsv.js) and validated for real
 *     (csv/analyzeRecords.js).
 *   • Photograph matching is real: exact then case-insensitive filename
 *     matching, with unmatched records, unused uploads and duplicate references
 *     all counted from the actual data (csv/photoMatching.js).
 *   • The proof pages place the customer's real names, titles, photographs and
 *     copy into a real Pressmark design template.
 *
 * What is simulated:
 *   • The rendering itself. Pages are composed as DOM from the template
 *     manifest, not exported from InDesign.
 *   • Stage timing. Real InDesign render times are not knowable from here.
 *   • "Automation time saved", which is an estimate from page count and is the
 *     only metric flagged `estimated`.
 *
 * Everything simulated is flagged via `ProofResult.simulated` and the
 * `estimated` flag on individual metrics, and the UI is required to label it.
 * We do not tell a customer that a render happened when it did not.
 *
 * No file contents and no personal information are logged. Parsed CSV rows are
 * handed in by the UI (which owns parsing and column mapping) and are used only
 * to compose the sample; nothing is transmitted and nothing is persisted.
 */

import {
  ASSET_KINDS,
  JOB_STATES,
  RENDER_STAGES,
  formatBytes,
} from "../models.js";
import { configFor } from "../publications.js";
import { schemaFor } from "../csv/schemas.js";
import { matchPhotos, warningsFromMatching } from "../csv/photoMatching.js";
import { templateFor } from "../templates/registry.js";
import { planProof } from "../render/proofPlan.js";
import { recordsFor } from "../photoProject.js";

/* A 300 DPI print target. Anything that lands under this at its placed size is
   worth flagging before it reaches a printer. */
const TARGET_DPI = 300;
const ACCEPTABLE_DPI = 200;

/* Roughly how large a portrait sits on a directory or yearbook page. Used to
   convert pixel dimensions into an effective print resolution. */
const PLACED_PORTRAIT_INCHES = 2.0;

/* Simulated stage durations, in ms. Fast enough not to bore, slow enough to
   read. A real renderer replaces this with server-reported progress. */
const STAGE_MS = [900, 1400, 1000, 800, 1100, 1300, 1600];

/* Count-aware phrasing. Pluralizing the noun but not the verb produces
   "1 image fall below print resolution", which reads as a bug to the customer
   in the exact place we are asking them to trust our attention to detail. */
const count = (n, singular, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;
const verb = (n, singular, plural) => (n === 1 ? singular : plural);

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Measure an image's natural pixel dimensions. Resolves null on failure. */
function measureImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Inspect the uploaded assets. This is the analysis a real pipeline would do
 * server-side; doing it here keeps the numbers honest even in the demo.
 */
async function analyzeAssets(assets) {
  const images = assets.filter((a) => a.kind === ASSET_KINDS.image);
  const data = assets.filter((a) => a.kind === ASSET_KINDS.data);
  const docs = assets.filter((a) => a.kind === ASSET_KINDS.document);

  const measurements = await Promise.all(
    images.map(async (asset) => ({ asset, size: await measureImage(asset.file) }))
  );

  const lowResolution = measurements.filter(({ size }) => {
    if (!size) return false;
    const shortEdge = Math.min(size.width, size.height);
    return shortEdge / PLACED_PORTRAIT_INCHES < ACCEPTABLE_DPI;
  });

  const borderline = measurements.filter(({ size }) => {
    if (!size) return false;
    const shortEdge = Math.min(size.width, size.height);
    const dpi = shortEdge / PLACED_PORTRAIT_INCHES;
    return dpi >= ACCEPTABLE_DPI && dpi < TARGET_DPI;
  });

  const totalBytes = assets.reduce((sum, a) => sum + a.size, 0);

  return {
    imageCount: images.length,
    dataCount: data.length,
    docCount: docs.length,
    lowResolution,
    borderline,
    unreadable: measurements.filter(({ size }) => !size).length,
    totalBytes,
    /* Filled in by the caller from the already-parsed project data. */
    recordIssues: [],
  };
}

/**
 * Build the metric list shown in the production report.
 *
 * Every figure here except "Estimated time saved" is counted from the
 * customer's actual files. That metric alone carries `estimated: true` and is
 * badged as an estimate in the UI.
 *
 * @returns {import('../models.js').ProductionMetric[]}
 */
function buildMetrics(analysis, config, project, dataReport) {
  const { matching, plan, recordCount } = dataReport;

  /* Sample pages come from the chosen template, not from a guess. */
  const pages = plan ? plan.pages.length : config?.suggestedProofPages ?? 4;

  /* A hand-built page of merged records is roughly 12 minutes of placement,
     alignment and proofing. The estimate is labelled as one in the UI. */
  const estimatedPages = Number.parseInt(project.organization.estimatedPageCount, 10);
  const savedHours = Math.max(
    1,
    Math.round(((Number.isFinite(estimatedPages) ? estimatedPages : 48) * 12) / 60)
  );

  const matchedTotal = matching ? matching.exact + matching.insensitive + matching.manual : 0;

  /** @type {import('../models.js').ProductionMetric[]} */
  const metrics = [
    {
      id: "files",
      label: "Files received",
      value: String(analysis.imageCount + analysis.dataCount + analysis.docCount),
      detail: `${formatBytes(analysis.totalBytes)} total`,
    },
    {
      id: "records",
      label: "Records parsed",
      value: recordCount > 0 ? String(recordCount) : "—",
      detail:
        recordCount > 0
          ? `From ${count(analysis.dataCount, "CSV file")}`
          : "No CSV supplied — manual content mode",
    },
    {
      id: "matched",
      label: "Photographs matched",
      value: matching ? String(matchedTotal) : String(analysis.imageCount),
      detail: matching
        ? `${matching.exact} exact, ${matching.insensitive} by case, of ${count(analysis.imageCount, "upload")}`
        : "Counted, not matched — no record list",
    },
  ];

  if (matching) {
    metrics.push(
      {
        id: "unmatched",
        label: "Unmatched records",
        value: String(matching.unmatched),
        detail:
          matching.unmatched === 0
            ? "Every record found its photograph"
            : "Named a file that was not uploaded",
      },
      {
        id: "unused",
        label: "Unused photographs",
        value: String(matching.unused.length),
        detail:
          matching.unused.length === 0
            ? "Every upload was placed"
            : "Uploaded but not referenced by any record",
      }
    );
  }

  const missingRequired = analysis.recordIssues.filter(
    (issue) => issue.severity === "error" && issue.id.startsWith("empty-required")
  );
  if (dataReport.recordCount > 0) {
    metrics.push({
      id: "missing-fields",
      label: "Missing required fields",
      value: String(missingRequired.reduce((sum, issue) => sum + (issue.rows?.length ?? 0), 0)),
      detail:
        missingRequired.length === 0 ? "All required columns are filled" : "See the notes below",
    });
  }

  metrics.push({
    id: "pages",
    label: "Sample pages generated",
    value: String(pages),
    detail: dataReport.templateName ? `Using ${dataReport.templateName}` : config?.sampleOutput ?? "",
  });

  if (plan && plan.recordsOmitted > 0) {
    metrics.push({
      id: "omitted",
      label: "Records omitted from sample",
      value: String(plan.recordsOmitted),
      detail: `The sample shows the first ${plan.recordsShown}. The full publication would carry all ${plan.recordsAvailable}.`,
    });
  }

  metrics.push(
    {
      id: "warnings",
      label: "Resolution warnings",
      value: String(analysis.lowResolution.length + analysis.borderline.length),
      detail:
        analysis.lowResolution.length + analysis.borderline.length === 0
          ? "All images clear the print target"
          : "See the notes below",
    },
    {
      id: "saved",
      label: "Estimated time saved",
      value: `~${savedHours} hr`,
      detail: "Estimate, based on your stated page count",
      estimated: true,
    }
  );

  return metrics;
}

/**
 * Build the warning list. These are real measurements over real data, not
 * decoration.
 *
 * @returns {import('../models.js').ProductionWarning[]}
 */
function buildWarnings(analysis, config, dataReport) {
  const warnings = [];

  if (analysis.lowResolution.length > 0) {
    warnings.push({
      id: "low-res",
      severity: "caution",
      message: `${count(analysis.lowResolution.length, "image")} ${verb(analysis.lowResolution.length, "falls", "fall")} below print resolution.`,
      detail: `Measured under ${ACCEPTABLE_DPI} DPI at a ${PLACED_PORTRAIT_INCHES}in placed size. These would look soft in print. We would request higher-resolution originals before production.`,
    });
  }

  if (analysis.borderline.length > 0) {
    warnings.push({
      id: "borderline-res",
      severity: "info",
      message: `${count(analysis.borderline.length, "image")} ${verb(analysis.borderline.length, "sits", "sit")} between ${ACCEPTABLE_DPI} and ${TARGET_DPI} DPI.`,
      detail: "Usable at a smaller placed size, but not ideal for a full-page treatment.",
    });
  }

  if (analysis.unreadable > 0) {
    warnings.push({
      id: "unreadable",
      severity: "caution",
      message: `${count(analysis.unreadable, "image")} could not be read in the browser.`,
      detail: "Often a CMYK JPEG or an unusual color profile. Our production pipeline handles these; the in-browser preview cannot.",
    });
  }

  /* Real filename reconciliation, when a CSV was supplied. */
  if (dataReport.matching) {
    warnings.push(...warningsFromMatching(dataReport.matching));
  }

  /* Data-quality findings from analyzeRecords(), translated into the report's
     warning vocabulary. Info-level notes about unrecognized columns are useful
     here for the same reason they are useful in the data step. */
  for (const issue of dataReport.recordIssues ?? []) {
    warnings.push({
      id: `data-${issue.id}`,
      severity: issue.severity === "error" ? "caution" : "info",
      message: issue.message,
      detail: issue.detail,
    });
  }

  if (dataReport.plan?.recordsOmitted > 0) {
    warnings.push({
      id: "records-omitted",
      severity: "info",
      message: `${count(dataReport.plan.recordsOmitted, "record")} did not fit in the sample.`,
      detail: `A proof shows a few pages, not the whole book. The sample places the first ${dataReport.plan.recordsShown} of your ${dataReport.plan.recordsAvailable} records; the complete publication would carry every one.`,
    });
  }

  if (dataReport.manualMode) {
    warnings.push({
      id: "manual-mode",
      severity: "info",
      message: "No spreadsheet was supplied, so the sample uses placeholder records.",
      detail:
        "The design, your colors and your logo are real. Upload a CSV to see your own names and details placed into this template.",
    });
  }

  return warnings;
}

/** Describe the pages the proof presents, from the planned template pages. */
function buildPages(plan, config) {
  if (!plan) {
    const label = config?.label ?? "Publication";
    return [
      { id: "cover", pageType: "cover", label: "Cover", caption: `${label} cover, set in your colors.` },
    ];
  }
  return plan.pages.map(({ page, records }) => ({
    id: page.id,
    pageType: page.pageType,
    label: page.label,
    caption: page.caption,
    recordCount: records.length,
  }));
}

/**
 * Parse-free data analysis: the rows were already parsed and mapped in the UI
 * (the customer had to confirm the column mapping), so the renderer consumes
 * them rather than re-reading the file.
 */
function buildDataReport(project) {
  const data = project.data ?? {};
  /* Quick Photo Proof synthesises one record per photograph; spreadsheet mode
     uses the parsed rows. One entry point so the report and the pages can never
     describe different content. */
  const records = recordsFor(project);
  const schema = schemaFor(data.schemaId);
  const template = templateFor(project.visual.templateId);

  const images = project.assets.filter((asset) => asset.kind === ASSET_KINDS.image);

  const matching =
    records.length > 0 && schema?.imageField
      ? matchPhotos(records, schema.imageField, images, data.photoOverrides ?? {})
      : null;

  const plan = template ? planProof(template, records) : null;

  return {
    recordCount: records.length,
    schema,
    template,
    templateName: template?.name ?? "",
    matching,
    plan,
    manualMode: records.length === 0,
    photoMode: project.mode === "photo",
    recordIssues: data.analysis?.issues ?? [],
  };
}

/**
 * @returns {import('./proofRenderer.js').ProofRenderer}
 */
export function createMockProofRenderer() {
  /** @type {Map<string, {project: object, status: object, result: object|null, timers: number[]}>} */
  const jobs = new Map();

  const setStatus = (jobId, patch) => {
    const job = jobs.get(jobId);
    if (!job) return;
    job.status = { ...job.status, ...patch };
  };

  return {
    isSimulated: true,

    async createProofJob(project) {
      const id = `proof_${uid()}`;
      jobs.set(id, {
        project,
        status: {
          state: JOB_STATES.queued,
          progress: 0,
          stageId: "",
          message: "Proof job created",
        },
        result: null,
        timers: [],
      });
      return {
        id,
        publicationTypeId: project.publicationTypeId,
        createdAt: new Date().toISOString(),
        status: jobs.get(id).status,
      };
    },

    /*
     * PHASE 2: this becomes a real transfer — request a signed PUT URL per
     * asset from /api/proof/upload-url, then PUT the File directly to object
     * storage so the payload never passes through a serverless function.
     * The mock only walks the list so the progress bar is honest about how
     * many files there are.
     */
    async uploadProofAssets(jobId, assets, onProgress) {
      const job = jobs.get(jobId);
      if (!job) throw new Error("Unknown proof job");
      setStatus(jobId, { state: JOB_STATES.uploading, message: "Preparing your files" });

      for (let i = 0; i < assets.length; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        onProgress?.((i + 1) / Math.max(assets.length, 1));
      }
      return { uploaded: assets.length };
    },

    async startProofRender(jobId) {
      const job = jobs.get(jobId);
      if (!job) throw new Error("Unknown proof job");

      setStatus(jobId, {
        state: JOB_STATES.rendering,
        progress: 0,
        stageId: RENDER_STAGES[0].id,
        message: RENDER_STAGES[0].label,
      });

      /* The real analysis runs while the stage animation plays, so the result
         is ready the moment the last stage finishes. */
      const analysisPromise = analyzeAssets(job.project.assets);

      let elapsed = 0;
      RENDER_STAGES.forEach((stage, index) => {
        elapsed += STAGE_MS[index] ?? 1000;
        const timer = setTimeout(() => {
          setStatus(jobId, {
            stageId: stage.id,
            progress: (index + 1) / RENDER_STAGES.length,
            message: stage.label,
          });
        }, elapsed);
        job.timers.push(timer);
      });

      const finish = setTimeout(async () => {
        try {
          const analysis = await analysisPromise;
          const config = configFor(job.project.publicationTypeId);
          const dataReport = buildDataReport(job.project);
          analysis.recordIssues = dataReport.recordIssues;
          const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

          job.result = {
            jobId,
            /* Still true: these pages were composed in the browser, not
               exported from InDesign. The data in them, however, is real. */
            simulated: true,
            templateId: dataReport.template?.id ?? "",
            plan: dataReport.plan,
            matching: dataReport.matching,
            manualMode: dataReport.manualMode,
            pages: buildPages(dataReport.plan, config),
            metrics: buildMetrics(analysis, config, job.project, dataReport),
            warnings: buildWarnings(analysis, config, dataReport),
            footerMark: dataReport.template?.footerMark?.text ?? "Pressmark Studio",
            expiresAt: expires.toISOString(),
          };
          setStatus(jobId, {
            state: JOB_STATES.complete,
            progress: 1,
            stageId: "",
            message: "Proof ready",
          });
        } catch {
          setStatus(jobId, {
            state: JOB_STATES.failed,
            message: "We could not build the proof",
            error: "Analysis failed. Please try again with fewer or smaller files.",
          });
        }
      }, elapsed + 250);
      job.timers.push(finish);
    },

    /*
     * Abandon a job and stop its timers.
     *
     * StrictMode runs an effect, tears it down and runs it again, so the first
     * run's job is abandoned by design. Without this its stage timers keep
     * firing against a job nobody is watching — harmless but untidy, and in a
     * real renderer it would be a wasted server render. Cleanup calls this so a
     * run's work stops with the run that created it.
     */
    async cancelProofJob(jobId) {
      const job = jobs.get(jobId);
      if (!job) return;
      for (const timer of job.timers) clearTimeout(timer);
      job.timers = [];
      jobs.delete(jobId);
    },

    async getProofStatus(jobId) {
      const job = jobs.get(jobId);
      if (!job) throw new Error("Unknown proof job");
      return { ...job.status };
    },

    async getProofResult(jobId) {
      const job = jobs.get(jobId);
      if (!job) throw new Error("Unknown proof job");
      if (!job.result) throw new Error("Proof is not ready yet");
      return job.result;
    },
  };
}
