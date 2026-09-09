/*
 * Pressmark Instant Proof — page orchestrator.
 *
 * Owns the wizard state, the validation rules and the renderer lifecycle. The
 * step components below it are presentational: they receive a value, an
 * onChange and an errors object, and know nothing about each other.
 *
 * ── Why this page is not part of App.jsx ──
 *
 * The site is a multi-page Vite build (see vite.config.js). Each route is its
 * own HTML entry with its own static <head>, which is what makes the marketing
 * pages indexable without SSR. /instant-proof follows that convention:
 * instant-proof.html → src/instant-proof.jsx → this component. vercel.json sets
 * cleanUrls, so the .html suffix never appears in the URL.
 *
 * ── Privacy ──
 *
 * Uploaded files live in React state as browser File objects and nowhere else.
 * Nothing is written to localStorage, nothing is sent over the network, and no
 * filename or field value is logged. Object URLs created for image previews are
 * revoked when a file is removed and when the page unmounts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";


import StepShell from "../instant-proof/components/StepShell.jsx";
import CreateStep from "../instant-proof/components/CreateStep.jsx";
import UploadStep from "../instant-proof/components/UploadStep.jsx";
import TemplatePreview from "../instant-proof/components/TemplatePreview.jsx";

import ProofProcessing from "../instant-proof/components/ProofProcessing.jsx";
import ProofResults from "../instant-proof/components/ProofResults.jsx";
import DirectoryRenderJob from "../instant-proof/components/DirectoryRenderJob.jsx";
import { ProofHeader, ProofFooter } from "../instant-proof/components/ProofChrome.jsx";


import { configFor, schemaIdsFor } from "../instant-proof/publications.js";
import {
  QUICK_PROOF_PHOTO_LIMIT,
  photosOf,
  suggestsPhotoLedDesign,
} from "../instant-proof/photoProject.js";
import { PROOF_EVENTS, emit } from "../instant-proof/analytics.js";
import { parseCsvFile } from "../instant-proof/csv/parseCsv.js";
import { schemaFor } from "../instant-proof/csv/schemas.js";
import {
  applyMapping,
  isCanonical,
  mappingFromProposals,
  suggestMapping,
} from "../instant-proof/csv/columnMapping.js";
import { analyzeRecords } from "../instant-proof/csv/analyzeRecords.js";
import { matchPhotos } from "../instant-proof/csv/photoMatching.js";
import { defaultTemplateFor, templateFor, templatesForPublication } from "../instant-proof/templates/registry.js";
import {
  ASSET_KINDS,
  JOB_STATES,
  PROOF_MODES,
  emptyProject,
  emptyProjectData,
  extensionOf,
  idleStatus,
  kindOf,
} from "../instant-proof/models.js";
import { getProofRenderer } from "../instant-proof/rendering/proofRenderer.js";
import { IP_CSS } from "../instant-proof/styles.js";
import { PROOF_CSS } from "../instant-proof/theme.css.js";

/*
 * Three steps, in both modes.
 *
 *   create -> upload -> proof
 *
 * The publication type, the build method and the design were three separate
 * screens; they are cheap choices with sensible defaults, so they are one now.
 * The spreadsheet path's column mapping and validation moved inside `upload`
 * rather than occupying a screen of their own.
 *
 * The list is fixed, so an index is safe again — but validation still keys off
 * step IDs, because that is what makes it readable.
 */
const STEPS = [
  { id: "create", label: "Create" },
  { id: "upload", label: "Upload" },
  { id: "proof", label: "Proof" },
];

const PROOF_STEP_INDEX = STEPS.length - 1;

/* A run that has produced nothing by now has stalled; surface Retry rather
   than spin for ever. The demonstration pipeline takes about eight seconds. */
const PROCESSING_TIMEOUT_MS = 30000;

/* How often we ask the renderer where it is. The mock updates on its own
   timers; a real renderer will be polled over HTTP at the same cadence. */
const POLL_MS = 400;

let assetCounter = 0;
const nextAssetId = () => `asset-${(assetCounter += 1)}`;

/** Wrap a File as an UploadedAsset, creating a preview URL for images. */
function toAsset(file, kindOverride) {
  const extension = extensionOf(file.name);
  const kind = kindOverride ?? kindOf(file.name);
  return {
    id: nextAssetId(),
    name: file.name,
    extension,
    size: file.size,
    kind,
    file,
    previewUrl:
      kind === ASSET_KINDS.image || kindOverride === ASSET_KINDS.logo
        ? URL.createObjectURL(file)
        : undefined,
  };
}

export default function InstantProof() {
  const initialRenderJobId = new URLSearchParams(window.location.search).get("job") || "";
  const [stepIndex, setStepIndex] = useState(initialRenderJobId ? PROOF_STEP_INDEX : 0);
  const [project, setProject] = useState(emptyProject);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(idleStatus);
  const [result, setResult] = useState(null);
  const [renderError, setRenderError] = useState("");
  /* The "Preview design" dialog, now that the chooser sits on step 1. */
  const [previewing, setPreviewing] = useState(null);
  const [renderJobId, setRenderJobId] = useState(initialRenderJobId);

  /*
   * One renderer for the life of the page.
   *
   * Lazily-initialised state rather than useMemo: React is explicitly allowed
   * to discard a memoized value and recompute it, and a second renderer would
   * arrive with an empty job map — the job created by the first would then be
   * unknown to the one being polled, leaving the proof at 0% or failing with
   * "we lost track of your proof job". State is never discarded, and unlike a
   * ref it can be read during render.
   */
  const [renderer] = useState(() => getProofRenderer());

  const pollRef = useRef(null);

  /*
   * Every increment starts a completely fresh processing run. Entering the
   * proof step increments it, Retry increments it, and coming Back and
   * rebuilding increments it again.
   */
  const [processingRunId, setProcessingRunId] = useState(0);

  /* The project as it was when the render began, read by the effect without
     making the whole project a dependency of it. */
  const projectRef = useRef(project);
  const headingRef = useRef(null);

  const config = configFor(project.publicationTypeId);

  const selectedTemplate = templateFor(project.visual.templateId);
  const inputMode = selectedTemplate?.inputMode ?? "photos";
  const photoMode = inputMode === "photos";
  const usesDirectoryQueue = Boolean(renderJobId) || inputMode === "csv";
  const photos = useMemo(() => photosOf(project), [project]);

  const steps = STEPS;
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex];

  const schema = schemaFor(project.data.schemaId);

  /* Live photo reconciliation for the data step. Recomputed from state rather
     than stored, so a manual override or a newly added image is reflected
     immediately without a second source of truth. */
  const matching = useMemo(() => {
    if (project.data.records.length === 0 || !schema?.imageField) return null;
    const images = project.assets.filter((asset) => asset.kind === ASSET_KINDS.image);
    return matchPhotos(project.data.records, schema.imageField, images, project.data.photoOverrides);
  }, [project.data.records, project.data.photoOverrides, project.assets, schema]);

  /* Move focus to the step heading on navigation. Without this a keyboard or
     screen-reader user is left at the bottom of the previous step with no
     indication that the content changed. Skipped on first paint so the page
     does not steal focus on load. */
  const firstPaint = useRef(true);
  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [safeIndex]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  /*
   * Object URLs are released when a file is removed and when the visitor starts
   * another proof — NOT on unmount.
   *
   * Revoking on unmount looked tidier but was a real bug: StrictMode mounts,
   * unmounts and remounts in development, so the cleanup fired while the
   * photographs were still on screen and every preview turned into a dead blob
   * URL. A genuine unmount means the visitor is leaving the page, at which
   * point the browser reclaims the blobs anyway — so the leak this guarded
   * against does not really exist, while the bug it caused certainly did.
   */
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const revoke = (asset) => {
    if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
  };

  /*
   * Parse a spreadsheet the moment it is added, entirely in the browser.
   *
   * The schema is chosen from the publication type's recommendation. A CSV
   * whose headers already match Pressmark's standard is auto-confirmed; anything
   * else lands on the mapping step for the customer to approve, because a
   * silently-applied guess is the one failure mode that survives all the way to
   * print.
   */
  const ingestCsv = useCallback(
    async (asset, publicationTypeId) => {
      const schemaId = schemaIdsFor(publicationTypeId)[0] ?? "people-directory";
      try {
        const table = await parseCsvFile(asset.file);
        const proposals = suggestMapping(table.headers, schemaId);
        const mapping = mappingFromProposals(proposals);
        const records = applyMapping(table.rows, mapping);
        const confirmed = isCanonical(proposals);
        const analysis = analyzeRecords(records, schemaId, table.headers, Object.keys(mapping));

        setProject((current) => ({
          ...current,
          data: {
            ...emptyProjectData(),
            schemaId,
            sourceAssetId: asset.id,
            headers: table.headers,
            rawRows: table.rows,
            records,
            proposals,
            mapping,
            mappingConfirmed: confirmed,
            analysis,
          },
        }));
      } catch {
        setProject((current) => ({
          ...current,
          data: {
            ...emptyProjectData(),
            sourceAssetId: asset.id,
            parseError: "We could not read that CSV. Please check it opens in a spreadsheet program and try again.",
          },
        }));
      }
    },
    []
  );

  const addAssets = useCallback(
    (files) => {
      const assets = files.map((file) => toAsset(file));
      setProject((current) => ({ ...current, assets: [...current.assets, ...assets] }));
      setErrors((current) => {
        if (!current.assets) return current;
        const next = { ...current };
        delete next.assets;
        return next;
      });

      /* The most recently added CSV wins — a customer who uploads a corrected
         file expects it to replace the previous one, not to be ignored. */
      const csv = assets.filter((asset) => asset.kind === ASSET_KINDS.data).at(-1);
      if (csv) ingestCsv(csv, project.publicationTypeId);
    },
    [ingestCsv, project.publicationTypeId]
  );

  const removeAsset = useCallback((id) => {
    setProject((current) => {
      const target = current.assets.find((asset) => asset.id === id);
      revoke(target);
      const assets = current.assets.filter((asset) => asset.id !== id);
      /* Dropping the spreadsheet the records came from has to drop the records
         too, or the proof would render data the customer believes they removed. */
      const data = current.data.sourceAssetId === id ? emptyProjectData() : current.data;
      return { ...current, assets, data };
    });
  }, []);

  const addLogo = useCallback((file) => {
    setProject((current) => {
      revoke(current.visual.logo);
      return { ...current, visual: { ...current.visual, logo: toAsset(file, ASSET_KINDS.logo) } };
    });
  }, []);

  const removeLogo = useCallback(() => {
    setProject((current) => {
      revoke(current.visual.logo);
      return { ...current, visual: { ...current.visual, logo: null } };
    });
  }, []);

  /*
   * Adding photographs. Separate from addAssets because the Quick Proof path
   * never involves a spreadsheet and should not walk the CSV ingest.
   */
  const addPhotos = useCallback(
    (files, { fromCamera = false } = {}) => {
      const added = files.map((file) => toAsset(file, ASSET_KINDS.image));
      setProject((current) => ({ ...current, assets: [...current.assets, ...added] }));
      setErrors((current) => {
        if (!current.photos) return current;
        const next = { ...current };
        delete next.photos;
        return next;
      });
      /* Counts and flags only — never a filename. */
      emit(PROOF_EVENTS.photosSelected, { photo_count: added.length, used_camera: fromCamera });
    },
    []
  );

  /* Which photographs appear when more were added than the sample can hold. */
  const togglePhotoSelected = useCallback((assetId) => {
    setProject((current) => {
      const all = photosOf(current).map((photo) => photo.id);
      const chosen =
        current.selectedPhotoIds?.length > 0
          ? current.selectedPhotoIds
          : all.slice(0, QUICK_PROOF_PHOTO_LIMIT);

      const next = chosen.includes(assetId)
        ? chosen.filter((id) => id !== assetId)
        : [...chosen, assetId].slice(0, QUICK_PROOF_PHOTO_LIMIT);

      return { ...current, selectedPhotoIds: next };
    });
  }, []);

  /* Details are stored on the asset, so they follow their photograph when
     others are removed. */
  const setPhotoDetails = useCallback((assetId, details) => {
    setProject((current) => ({
      ...current,
      assets: current.assets.map((asset) =>
        asset.id === assetId ? { ...asset, details } : asset
      ),
    }));
  }, []);

  const selectMode = useCallback((mode) => {
    setProject((current) => {
      const photoLed = mode === PROOF_MODES.photo;
      /* Preselect a sensible design so nobody is blocked on a choice. */
      const templateId =
        current.visual.templateId ||
        defaultTemplateFor(current.publicationTypeId, { photoLed });
      return { ...current, mode, visual: { ...current.visual, templateId } };
    });
    emit(
      mode === PROOF_MODES.photo ? PROOF_EVENTS.quickProofStarted : PROOF_EVENTS.spreadsheetModeSelected,
      { proof_mode: mode }
    );
  }, []);

  /*
   * Changing the publication type can invalidate an already-chosen design: a
   * customer who picks Yearbook, selects Yearbook Modern, then switches to
   * Church Directory would otherwise carry a yearbook template into a directory
   * proof. Clear it unless the template also serves the new type.
   */
  const selectPublicationType = useCallback((publicationTypeId) => {
    setProject((current) => {
      const stillValid =
        current.visual.templateId &&
        templatesForPublication(publicationTypeId).some(
          (template) => template.id === current.visual.templateId
        );
      const photoLed = current.mode === PROOF_MODES.photo && suggestsPhotoLedDesign(current);
      return {
        ...current,
        publicationTypeId,
        visual: {
          ...current.visual,
          /* Preselected rather than cleared: a visitor should never be stopped
             by a design decision they have no opinion about yet. */
          templateId: stillValid
            ? current.visual.templateId
            : defaultTemplateFor(publicationTypeId, { photoLed }),
        },
      };
    });
  }, []);

  /*
   * Re-derive records whenever the customer edits the mapping. Records are a
   * projection of (rawRows × mapping), never independently edited state, so the
   * two can never drift apart.
   */
  const applyProposals = useCallback((proposals) => {
    setProject((current) => {
      const mapping = mappingFromProposals(proposals);
      const records = applyMapping(current.data.rawRows, mapping);
      return {
        ...current,
        data: {
          ...current.data,
          proposals,
          mapping,
          records,
          analysis: analyzeRecords(
            records,
            current.data.schemaId,
            current.data.headers,
            Object.keys(mapping)
          ),
        },
      };
    });
  }, []);

  const confirmMapping = useCallback(() => {
    setProject((current) => ({ ...current, data: { ...current.data, mappingConfirmed: true } }));
    setErrors((current) => {
      const next = { ...current };
      delete next.data;
      return next;
    });
  }, []);

  const reopenMapping = useCallback(() => {
    setProject((current) => ({ ...current, data: { ...current.data, mappingConfirmed: false } }));
  }, []);

  const setPhotoOverride = useCallback((rowKey, assetId) => {
    setProject((current) => {
      const photoOverrides = { ...current.data.photoOverrides };
      if (assetId) photoOverrides[rowKey] = assetId;
      else delete photoOverrides[rowKey];
      return { ...current, data: { ...current.data, photoOverrides } };
    });
  }, []);

  /* ── Validation ── */

  /*
   * Validation is keyed by step ID. The step list is variable — the data step
   * comes and goes with the spreadsheet — so an index-based switch would
   * validate the wrong step as soon as that happened.
   */
  /*
   * Validation, keyed by step ID.
   *
   * ── What is required to render a proof ──
   *
   *   a publication type, a design, at least one supported photograph, and
   *   permission to use it.
   *
   * That is the whole list. No email, no contact name, no job title, no phone,
   * no deadline, no organization. Those were required until this refactor and
   * none of them were ever needed to draw a page — they were a lead-capture
   * form wearing a wizard's clothes. Email is asked for once, later, when a
   * visitor asks for something that needs a reply.
   */
  /*
   * Validation, keyed by step ID.
   *
   * ── What a proof actually requires ──
   *
   *   a build method, a publication type, a design, some content, and
   *   permission to use it.
   *
   * That is the whole list. No email, no contact name, no job title, no phone,
   * no deadline, no organization. Email is asked for once, later, only when a
   * visitor asks for something that needs a reply.
   */
  const validateStep = (stepId) => {
    const found = {};

    if (stepId === "create") {
      if (!project.publicationTypeId) {
        found.publicationTypeId = "Choose what you are creating.";
      }
      if (!project.visual.templateId) {
        found.templateId = "Choose a Pressmark design.";
      }
    }

    if (stepId === "upload") {
      if (photoMode) {
        if (photos.length === 0) {
          found.photos = "Add at least one photograph so we have something to build from.";
        }
      } else if (project.assets.length === 0) {
        found.assets = "Add your spreadsheet and photographs.";
      } else if (inputMode === "csv") {
        if (!project.assets.some((asset) => asset.kind === ASSET_KINDS.data)) {
          found.assets = "Add the directory CSV before continuing.";
        }
      } else if (project.data.parseError) {
        found.data = project.data.parseError;
      } else if (project.data.records.length > 0) {
        if (!project.data.mappingConfirmed) {
          found.data = "Confirm how your columns map to Pressmark's fields.";
        } else {
          /* A missing required column is a hard stop: the template binds to it,
             and rendering without it produces a page of blanks. This is about
             the SPREADSHEET's own schema — never about an email or a job
             title, neither of which is ever required to render. */
          const blocking = (project.data.analysis?.issues ?? []).filter(
            (issue) => issue.severity === "error" && issue.id === "missing-required-columns"
          );
          if (blocking.length > 0) {
            found.data = "Map a column to every required Pressmark field before continuing.";
          }
        }
      }

      if (!found.photos && !found.assets && !project.consentGranted) {
        found.consent = "Please confirm you have permission to use this content.";
      }
    }

    return found;
  };

  /* Why Continue is disabled, said plainly rather than left to be guessed. */
  const blockingReason = () => {
    const found = validateStep(step.id);
    const messages = Object.values(found);
    if (messages.length === 0) return "";
    if (messages.length === 1) return messages[0];
    return `${messages.length} things still needed: ${messages.join(" ")}`;
  };

  const stepIsComplete = Object.keys(validateStep(step.id)).length === 0;

  const goTo = (index) => {
    setErrors({});
    setStepIndex(index);
  };

  const back = () => goTo(Math.max(safeIndex - 1, 0));

  /*
   * The last input step, by ID.
   *
   * This previously compared against "review", a step deleted in the move to
   * three steps — so it was permanently false and Continue never started a
   * proof. Derived from the step list now, so removing or renaming a step
   * cannot silently strand the proof screen again.
   */
  const isLastInput = step?.id === STEPS[STEPS.length - 2].id;

  const next = () => {
    const found = validateStep(step.id);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (isLastInput) {
      beginProof();
      return;
    }
    goTo(safeIndex + 1);
  };



  /* ── Processing lifecycle ── */

  /*
   * Called once a run finishes. Held in a ref so the pipeline effect can invoke
   * the latest version without taking it as a dependency — otherwise every
   * render would produce a new identity, the effect would re-run, and the
   * pipeline would restart itself forever.
   */
  const completeProof = useCallback((proof) => {
    setResult(proof);
    const snapshot = projectRef.current;
    /* Counts and our own slugs. No filename, no name, no address. */
    emit(PROOF_EVENTS.proofGenerated, {
      proof_mode: snapshot.mode,
      photo_count: photosOf(snapshot).length,
      page_count: proof.pages.length,
      has_organization: Boolean(snapshot.organization.organizationName.trim()),
      has_logo: Boolean(snapshot.visual.logo),
      template_id: snapshot.visual.templateId,
    });
  }, []);

  const completeProofRef = useRef(completeProof);
  useEffect(() => {
    completeProofRef.current = completeProof;
  }, [completeProof]);

  /*
   * Move to the proof screen, and mark this as a new run.
   *
   * Does no work itself. The effect below runs whenever the visitor is ON the
   * proof step, so simply arriving there starts processing — which is what
   * makes the previous failure impossible: there is no button-identity check
   * left to go stale. Incrementing the run id additionally forces a fresh run
   * when we are already on that step, which is what Retry needs.
   */
  const beginProof = useCallback(() => {
    setStepIndex(PROOF_STEP_INDEX);
    setProcessingRunId((id) => id + 1);
  }, []);

  /*
   * The pipeline.
   *
   * ── Why this is StrictMode-safe ──
   *
   * StrictMode runs an effect, tears it down, and runs it again. There is NO
   * persistent "already started" flag — such a flag is precisely what breaks
   * under StrictMode, because the second setup sees it set and refuses to run
   * while the first setup's work has already been cancelled, leaving nothing
   * running at all.
   *
   * Instead every setup is capable of starting a complete run from scratch, and
   * cleanup cancels ONLY the work that setup created: its own `cancelled`
   * flag, its own timeout ids, its own job. Two setups therefore produce one
   * live run, and one setup produces one live run.
   *
   * Leaving the proof step tears the run down; returning starts a new one. So
   * Back-then-rebuild is a fresh run for free, with no extra bookkeeping.
   */
  useEffect(() => {
    /*
     * Being on the proof step IS the condition to process. Not "was a button
     * clicked", not "has a flag been set" — the screen and the work cannot
     * disagree, because one is derived from the other.
     */
    if (step.id !== "proof") return undefined;
    if (usesDirectoryQueue) return undefined;

    let cancelled = false;
    let jobId = null;
    const timeoutIds = [];

    const delay = (milliseconds) =>
      new Promise((resolve) => {
        timeoutIds.push(setTimeout(resolve, milliseconds));
      });

    const runPipeline = async () => {
      /* A new run always starts from a clean slate. */
      setRenderError("");
      setResult(null);
      setStatus({
        state: JOB_STATES.uploading,
        progress: 0,
        stageId: "",
        message: "Preparing your files",
      });

      const snapshot = projectRef.current;

      try {
        const job = await renderer.createProofJob(snapshot);
        if (cancelled) {
          /* Cleanup ran while the job was being created, so it was never
             recorded for cancellation. Cancel it here or its stage timers
             outlive the run that asked for them. */
          renderer.cancelProofJob?.(job.id);
          return;
        }
        jobId = job.id;

        await renderer.uploadProofAssets(job.id, snapshot.assets, (fraction) => {
          if (cancelled) return;
          setStatus((current) => ({
            ...current,
            state: JOB_STATES.uploading,
            /* Monotonic, so a late callback cannot drag the bar backwards. */
            progress: Math.max(current.progress, fraction * 0.05),
          }));
        });
        if (cancelled) return;

        await renderer.startProofRender(job.id);
        if (cancelled) return;

        /*
         * Poll on a timeout chain rather than an interval, so every timer this
         * run creates is in `timeoutIds` and dies with the run. The renderer
         * walks the seven stages on a fixed schedule, so progress advances
         * deterministically and finishes in about eight seconds.
         */
        const deadline = Date.now() + PROCESSING_TIMEOUT_MS;
        for (;;) {
          if (cancelled) return;

          const next = await renderer.getProofStatus(job.id);
          if (cancelled) return;
          setStatus(next);

          if (next.state === JOB_STATES.complete) {
            const proof = await renderer.getProofResult(job.id);
            if (cancelled) return;
            /* Hold the completed bar briefly so 100% is actually seen. Without
               it the result swaps in during the same commit and the finished
               state never paints — the work looks like it jumps from 86% to a
               different screen. */
            await delay(450);
            if (cancelled) return;
            completeProofRef.current(proof);
            return;
          }
          if (next.state === JOB_STATES.failed) {
            throw new Error(next.error || "The proof could not be generated.");
          }
          if (Date.now() > deadline) {
            throw new Error("Processing took longer than expected.");
          }

          await delay(POLL_MS);
        }
      } catch (error) {
        if (cancelled) return;
        setRenderError(error?.message || "We could not build your proof. Please try again.");
      }
    };

    runPipeline();

    return () => {
      cancelled = true;
      for (const id of timeoutIds) clearTimeout(id);
      /* Stop the abandoned job's own timers too, so a cancelled run leaves
         nothing at all running. */
      if (jobId) renderer.cancelProofJob?.(jobId);
    };
  }, [step.id, processingRunId, renderer, usesDirectoryQueue]);

  const startOver = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    project.assets.forEach(revoke);
    revoke(project.visual.logo);
    setProject(emptyProject());
    setPreviewing(null);
    setResult(null);
    setStatus(idleStatus());
    setRenderError("");
    setErrors({});
    setProcessingRunId(0);
    setStepIndex(0);
    setRenderJobId("");
    window.history.replaceState({}, "", window.location.pathname);
  };

  const rememberRenderJob = useCallback((jobId) => {
    setRenderJobId(jobId);
    const url = new URL(window.location.href);
    url.searchParams.set("job", jobId);
    window.history.replaceState({}, "", url);
  }, []);

  /* ── Rendering the current step ── */

  const isResults = step.id === "proof" && result && !renderError;

  const STEP_COPY = {
    create: {
      title: inputMode === "csv" ? "Choose Directory Classic" : "What are you creating?",
      lead: "Pick how you want to build it and what you are making. Choose a Pressmark design and we will render your free proof.",
    },
    upload: photoMode
      ? {
          title: "Add your photographs",
          lead: `Take them now or choose them from your library. One is enough to see a proof; ${QUICK_PROOF_PHOTO_LIMIT} fills the sample.`,
        }
      : {
          title: "Upload Spreadsheet",
          lead: "Upload one CSV. We will validate the supported fields and alphabetize every valid record before it is queued.",
        },
    proof: { title: "Building your proof", lead: "" },
  };
  const copy = STEP_COPY[step.id];

  return (
    <div className="ip-root">
      <style>{IP_CSS}</style>
      <style>{PROOF_CSS}</style>

      <ProofHeader />

      <main style={{ flex: 1 }}>
        {step.id === "proof" ? (
          <div className="ip-page">
            {usesDirectoryQueue ? (
              <div className="ip-section-tight">
                <p className="ip-eyebrow">Step 3 of 3</p>
                <h1 className="ip-h1" ref={headingRef} tabIndex={-1}>Generate and download proof</h1>
                <DirectoryRenderJob
                  csv={project.assets.find((asset) => asset.kind === ASSET_KINDS.data)?.file}
                  templateId={selectedTemplate?.id ?? ""}
                  initialJobId={renderJobId}
                  onJobId={rememberRenderJob}
                  onStartOver={startOver}
                />
              </div>
            ) : isResults ? (
              <div className="ip-section-tight">
                <ProofResults
                  project={project}
                  inputMode={inputMode}
                  config={config}
                  result={result}
                  onStartOver={startOver}
                  summary={{
                    templateName: templateFor(project.visual.templateId)?.name ?? "",
                    photoCount: photos.length,
                    recordCount: result.plan?.recordsAvailable ?? 0,
                  }}
                  onCtaEvent={(kind) =>
                    emit(
                      kind === "quote"
                        ? PROOF_EVENTS.quoteFormOpened
                        : kind === "review"
                          ? PROOF_EVENTS.projectReviewOpened
                          : PROOF_EVENTS.emailUpdatesSelected,
                      { proof_mode: project.mode }
                    )
                  }
                />
              </div>
            ) : (
              <div className="ip-section-tight">
                <p className="ip-eyebrow">
                  Step {STEPS.length} of {STEPS.length}
                </p>
                <h1 className="ip-h1" ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
                  {copy.title}
                </h1>
                <div className="ip-section">
                  <ProofProcessing
                    status={status}
                    simulated={renderer.isSimulated}
                    error={renderError}
                    onRetry={beginProof}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <StepShell
            step={safeIndex + 1}
            totalSteps={STEPS.length}
            title={copy.title}
            lead={copy.lead}
            headingRef={headingRef}
            onBack={safeIndex > 0 ? back : undefined}
            onContinue={next}
            continueLabel={step.id === "upload" ? "Build My Free Proof" : "Continue"}
            continueDisabled={!stepIsComplete}
            blockingReason={blockingReason()}
          >
            {step.id === "create" && (
              <div className="ip-create">
                <div style={{ minWidth: 0 }}>
                  <CreateStep
                    mode={project.mode}
                    onModeChange={selectMode}
                    publicationTypeId={project.publicationTypeId}
                    onPublicationChange={selectPublicationType}
                    templateId={project.visual.templateId}
                    inputMode={inputMode}
                    onTemplateChange={(templateId) =>
                      setProject((current) => ({ ...current, visual: { ...current.visual, templateId } }))
                    }
                    onPreview={setPreviewing}
                    proofPages={templateFor(project.visual.templateId)?.pages?.length ?? 6}
                    errors={errors}
                  />
                </div>

                {/* Desktop only — a restrained reminder of the chosen design,
                    never a full-size cover. Hidden from assistive technology
                    because the carousel already conveys the selection. */}
                <aside className="ip-aside ip-desktop-only" aria-hidden="true">
                  {templateFor(project.visual.templateId) && (
                    <>
                      <span className="ip-label">Your design</span>
                      <span className="ip-aside-frame">
                        <img
                          src={templateFor(project.visual.templateId).thumbnail}
                          alt=""
                          style={{
                            objectFit:
                              project.visual.templateId === "directory-classic" ? "contain" : "cover",
                          }}
                        />
                      </span>
                      <p className="ip-design-name" style={{ marginTop: "var(--proof-space-4)" }}>
                        {templateFor(project.visual.templateId).name}
                      </p>
                    </>
                  )}
                </aside>
              </div>
            )}

            {step.id === "upload" && (
              <UploadStep
                project={project}
                config={config}
                photos={photos}
                matching={matching}
                errors={errors}
                onAddPhotos={addPhotos}
                onRemoveAsset={removeAsset}
                onToggleSelected={togglePhotoSelected}
                onPhotoDetails={setPhotoDetails}
                onAddAssets={addAssets}
                onOrganizationChange={(organization) => setProject((current) => ({ ...current, organization }))}
                onVisualChange={(visual) => setProject((current) => ({ ...current, visual }))}
                onLogoAdd={addLogo}
                onLogoRemove={removeLogo}
                onConsentChange={(consentGranted) =>
                  setProject((current) => ({ ...current, consentGranted }))
                }
                onApplyProposals={applyProposals}
                onConfirmMapping={confirmMapping}
                onReopenMapping={reopenMapping}
                onPhotoOverride={setPhotoOverride}
                onEvent={(kind) =>
                  emit(
                    kind === "organization"
                      ? PROOF_EVENTS.organizationDetailsOpened
                      : PROOF_EVENTS.optionalDetailsOpened
                  )
                }
              />
            )}
          </StepShell>
        )}
      </main>

      {previewing && (
        <TemplatePreview
          template={previewing}
          visual={project.visual}
          organization={project.organization}
          publicationLabel={config?.label ?? "Publication"}
          onClose={() => setPreviewing(null)}
        />
      )}

      <ProofFooter />
    </div>
  );
}
