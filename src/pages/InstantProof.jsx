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

import ProofStepper from "../instant-proof/components/ProofStepper.jsx";
import PublicationTypeSelector from "../instant-proof/components/PublicationTypeSelector.jsx";
import ModeSelector from "../instant-proof/components/ModeSelector.jsx";
import PhotoUploadPanel from "../instant-proof/components/PhotoUploadPanel.jsx";
import PhotoDetailsPanel from "../instant-proof/components/PhotoDetailsPanel.jsx";
import OrganizationDisclosure from "../instant-proof/components/OrganizationDisclosure.jsx";
import TemplateSelector from "../instant-proof/components/TemplateSelector.jsx";
import TemplatePreview from "../instant-proof/components/TemplatePreview.jsx";
import ProofUploadPanel from "../instant-proof/components/ProofUploadPanel.jsx";
import SubmissionReview from "../instant-proof/components/SubmissionReview.jsx";
import ProofProcessing from "../instant-proof/components/ProofProcessing.jsx";
import ProofResults from "../instant-proof/components/ProofResults.jsx";
import { ProofHeader, ProofFooter } from "../instant-proof/components/ProofChrome.jsx";

import DataReviewPanel from "../instant-proof/components/DataReviewPanel.jsx";
import ColumnMappingPanel from "../instant-proof/components/ColumnMappingPanel.jsx";
import PhotoReconciliation from "../instant-proof/components/PhotoReconciliation.jsx";

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
import { IP, IP_CSS, PALETTE, FONT_STACK, PAGE_X } from "../instant-proof/styles.js";

/*
 * The wizard's steps, by mode.
 *
 * ── Quick Photo Proof ──
 *
 *   publication -> photos -> details -> proof
 *
 * Three screens before a proof, and only the first two ask for anything. The
 * old flow had a mandatory six-field organization step — name, contact, email,
 * trim size, page count, deadline — standing between a visitor and their first
 * look at their own photographs. All of it is now optional and behind a
 * disclosure on the details step.
 *
 * ── Spreadsheet ──
 *
 *   publication -> content -> data -> review -> proof
 *
 * Unchanged, minus the organization gate. Every CSV capability is intact.
 *
 * The "data" step is conditional even within that mode: it appears once a
 * spreadsheet has been parsed. Because the list is variable, validation and
 * navigation key off step IDs, never numeric indices.
 */
const PHOTO_STEPS = [
  { id: "type", label: "Publication" },
  { id: "photos", label: "Photos" },
  { id: "details", label: "Details" },
  { id: "generate", label: "Proof" },
];

const DATA_STEPS = [
  { id: "type", label: "Publication" },
  { id: "content", label: "Content" },
  { id: "data", label: "Your data", conditional: true },
  { id: "review", label: "Review" },
  { id: "generate", label: "Proof" },
];

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
  const [stepIndex, setStepIndex] = useState(0);
  const [project, setProject] = useState(emptyProject);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(idleStatus);
  const [result, setResult] = useState(null);
  const [renderError, setRenderError] = useState("");
  /* The "Preview design" dialog, now that the chooser sits on step 1. */
  const [previewing, setPreviewing] = useState(null);

  /* One renderer for the life of the page. Swapping the mock for a live
     implementation happens inside getProofRenderer(), not here. */
  const renderer = useMemo(() => getProofRenderer(), []);
  const jobIdRef = useRef(null);
  const pollRef = useRef(null);
  const headingRef = useRef(null);

  const config = configFor(project.publicationTypeId);

  const photoMode = project.mode === PROOF_MODES.photo;
  const photos = useMemo(() => photosOf(project), [project]);

  /* The data step only exists once a spreadsheet has been parsed. */
  const hasData = project.data.records.length > 0 || Boolean(project.data.parseError);
  const steps = useMemo(() => {
    const source = photoMode ? PHOTO_STEPS : DATA_STEPS;
    return source.filter((entry) => !entry.conditional || hasData);
  }, [photoMode, hasData]);

  /* A step can disappear underneath us — removing the only CSV while standing
     on the data step. Clamping keeps stepIndex addressable at all times. */
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

  /*
   * Release every object URL when the page goes away.
   *
   * Reads through a ref rather than closing over `project`, so the cleanup sees
   * the final asset list rather than the empty one it was mounted with. Without
   * this, a visitor who navigates away leaves every photograph's blob pinned in
   * memory for the life of the tab.
   */
  const assetsRef = useRef([]);
  useEffect(() => {
    assetsRef.current = [...project.assets, project.visual.logo].filter(Boolean);
  }, [project.assets, project.visual.logo]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      for (const asset of assetsRef.current) {
        if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
      }
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
  const validateStep = (stepId) => {
    const found = {};

    if (stepId === "type") {
      if (!project.publicationTypeId) {
        found.publicationTypeId = "Choose the kind of publication you need.";
      }
      if (!project.visual.templateId) {
        found.templateId = "Choose a Pressmark design.";
      }
    }

    if (stepId === "photos") {
      if (photos.length === 0) {
        found.photos = "Add at least one photograph so we have something to build from.";
      } else if (!project.consentGranted) {
        found.consent = "Please confirm you have permission to use these photographs.";
      }
    }

    if (stepId === "content" && project.assets.length === 0) {
      found.assets = "Add at least one file so we have something to build from.";
    }

    if (stepId === "data") {
      if (project.data.parseError) {
        found.data = project.data.parseError;
      } else if (!project.data.mappingConfirmed) {
        found.data = "Please confirm how your columns map to Pressmark's fields.";
      } else {
        /* A missing required column is a hard stop: the template binds to it,
           and rendering without it produces a page full of blanks. Note this is
           about the SPREADSHEET's own schema — never about email or a job
           title, neither of which is ever required to render. */
        const blocking = (project.data.analysis?.issues ?? []).filter(
          (issue) => issue.severity === "error" && issue.id === "missing-required-columns"
        );
        if (blocking.length > 0) {
          found.data = "Map a column to every required Pressmark field before continuing.";
        }
      }
    }

    if (stepId === "review" && !project.consentGranted) {
      found.consent = "Please confirm you have permission to share this content.";
    }

    return found;
  };

  const goTo = (index) => {
    setErrors({});
    setStepIndex(index);
  };

  const back = () => goTo(Math.max(safeIndex - 1, 0));

  const isLastInput = step?.id === "review";

  const next = () => {
    const found = validateStep(step.id);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (isLastInput) {
      startRender();
      return;
    }
    goTo(safeIndex + 1);
  };

  /*
   * Straight from the photographs to a rendered proof, skipping the optional
   * details step. Validation still runs — permission is never skippable.
   */
  const skipToProof = () => {
    const found = validateStep("photos");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    startRender();
  };

  /* SubmissionReview's edit links address steps by ID, since their positions
     shift with the conditional data step. */
  const goToStepId = (stepId) => {
    const index = steps.findIndex((entry) => entry.id === stepId);
    if (index >= 0) goTo(index);
  };

  /* ── Rendering ── */

  const startRender = useCallback(async () => {
    setRenderError("");
    setResult(null);
    setStatus(idleStatus());
    /* "generate" is always last, in both the full and the reduced step list. */
    setStepIndex(steps.length - 1);

    try {
      const job = await renderer.createProofJob(project);
      jobIdRef.current = job.id;

      await renderer.uploadProofAssets(job.id, project.assets, (fraction) => {
        setStatus((current) => ({ ...current, state: JOB_STATES.uploading, progress: fraction * 0.05 }));
      });

      await renderer.startProofRender(job.id);

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const nextStatus = await renderer.getProofStatus(job.id);
          setStatus(nextStatus);

          if (nextStatus.state === JOB_STATES.complete) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            const proof = await renderer.getProofResult(job.id);
            setResult(proof);
            /* Counts and our own slugs. No filename, no name, no address. */
            emit(PROOF_EVENTS.proofGenerated, {
              proof_mode: project.mode,
              photo_count: photosOf(project).length,
              page_count: proof.pages.length,
              has_organization: Boolean(project.organization.organizationName.trim()),
              has_logo: Boolean(project.visual.logo),
              template_id: project.visual.templateId,
            });
          } else if (nextStatus.state === JOB_STATES.failed) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setRenderError(nextStatus.error || "The proof could not be generated.");
          }
        } catch {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRenderError("We lost track of your proof job. Please try again.");
        }
      }, POLL_MS);
    } catch {
      setRenderError("We could not start the proof. Please try again.");
    }
  }, [project, renderer, steps.length]);

  const startOver = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    project.assets.forEach(revoke);
    revoke(project.visual.logo);
    jobIdRef.current = null;
    setProject(emptyProject());
    setPreviewing(null);
    setResult(null);
    setStatus(idleStatus());
    setRenderError("");
    setErrors({});
    setStepIndex(0);
  };

  /* ── Rendering the current step ── */

  const organizationDisclosure = (
    <OrganizationDisclosure
      organization={project.organization}
      onOrganizationChange={(organization) => setProject((current) => ({ ...current, organization }))}
      visual={project.visual}
      onVisualChange={(visual) => setProject((current) => ({ ...current, visual }))}
      onLogoAdd={addLogo}
      onLogoRemove={removeLogo}
      onOpened={() => emit(PROOF_EVENTS.organizationDetailsOpened)}
    />
  );

  const consentCheckbox = (label) => (
    <label
      htmlFor="proof-consent"
      style={{
        display: "flex",
        gap: "0.7rem",
        alignItems: "flex-start",
        padding: "0.9rem 1rem",
        border: `1px solid ${errors.consent ? "#b3261e" : PALETTE.hairline}`,
        borderRadius: 3,
        background: PALETTE.white,
        cursor: "pointer",
      }}
    >
      <input
        id="proof-consent"
        type="checkbox"
        checked={project.consentGranted}
        onChange={(event) =>
          setProject((current) => ({ ...current, consentGranted: event.target.checked }))
        }
        aria-invalid={errors.consent ? "true" : undefined}
        style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, accentColor: PALETTE.accent, cursor: "pointer" }}
      />
      <span style={{ fontSize: "0.87rem", lineHeight: 1.6, color: PALETTE.text }}>{label}</span>
    </label>
  );

  const stepContent = () => {
    switch (step.id) {
      case "type":
        return (
          <div style={{ display: "grid", gap: "2rem" }}>
            <div>
              <h3 style={{ ...IP.label, marginBottom: "0.7rem" }} id="mode-label">
                How would you like to build it?
              </h3>
              <ModeSelector value={project.mode} onChange={selectMode} />
            </div>

            <div>
              <h3 style={{ ...IP.label, marginBottom: "0.7rem" }}>What are you creating?</h3>
              <PublicationTypeSelector
                value={project.publicationTypeId}
                onChange={selectPublicationType}
                error={errors.publicationTypeId}
              />
            </div>

            {project.publicationTypeId && (
              <div>
                <h3 style={{ ...IP.label, marginBottom: "0.7rem" }}>Which Pressmark design?</h3>
                <TemplateSelector
                  publicationTypeId={project.publicationTypeId}
                  value={project.visual.templateId}
                  onChange={(templateId) =>
                    setProject((current) => ({ ...current, visual: { ...current.visual, templateId } }))
                  }
                  onPreview={setPreviewing}
                  error={errors.templateId}
                />
              </div>
            )}
          </div>
        );

      case "photos":
        return (
          <div style={{ display: "grid", gap: "1.75rem" }}>
            <PhotoUploadPanel
              photos={photos}
              onAdd={addPhotos}
              onRemove={removeAsset}
              selectedIds={project.selectedPhotoIds ?? []}
              onToggleSelected={togglePhotoSelected}
              error={errors.photos}
            />
            {photos.length > 0 && (
              <>
                {consentCheckbox(
                  "I have permission to use these photographs, and I authorize Pressmark Studio to use them to produce this sample proof."
                )}
                {errors.consent && (
                  <span role="alert" style={IP.error}>{errors.consent}</span>
                )}
              </>
            )}
          </div>
        );

      case "details":
        return (
          <div style={{ display: "grid", gap: "2rem" }}>
            <PhotoDetailsPanel
              photos={photos}
              onDetailsChange={setPhotoDetails}
              onOpened={() => emit(PROOF_EVENTS.optionalDetailsOpened)}
            />
            {organizationDisclosure}
          </div>
        );

      case "content":
        return (
          <ProofUploadPanel
            config={config}
            assets={project.assets}
            onAdd={addAssets}
            onRemove={removeAsset}
            error={errors.assets}
            publicationTypeId={project.publicationTypeId}
          />
        );

      case "data":
        return (
          <div style={{ display: "grid", gap: "2.25rem" }}>
            {project.data.parseError ? (
              <p role="alert" style={{ ...IP.notice, borderLeftColor: "#b3261e" }}>
                {project.data.parseError}
              </p>
            ) : (
              <>
                {!project.data.mappingConfirmed && (
                  <>
                    <ColumnMappingPanel
                      schemaId={project.data.schemaId}
                      proposals={project.data.proposals}
                      sampleRows={project.data.rawRows.slice(0, 5)}
                      onChange={applyProposals}
                    />
                    <button
                      type="button"
                      className="ip-btn-primary ip-touch"
                      style={{ ...IP.btnPrimary, justifySelf: "start" }}
                      onClick={confirmMapping}
                    >
                      Confirm these columns →
                    </button>
                  </>
                )}

                {project.data.mappingConfirmed && (
                  <>
                    <DataReviewPanel data={project.data} matching={matching} />
                    <PhotoReconciliation
                      matching={matching}
                      assets={project.assets.filter((asset) => asset.kind === ASSET_KINDS.image)}
                      overrides={project.data.photoOverrides}
                      onOverride={setPhotoOverride}
                    />
                    <button
                      type="button"
                      className="ip-btn-ghost ip-touch"
                      style={{ ...IP.btnGhost, justifySelf: "start" }}
                      onClick={reopenMapping}
                    >
                      Change column mapping
                    </button>
                  </>
                )}

                {errors.data && <span role="alert" style={IP.error}>{errors.data}</span>}
              </>
            )}
          </div>
        );

      case "review":
        return (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <SubmissionReview
              project={project}
              config={config}
              onEditStep={goToStepId}
              onConsentChange={(consentGranted) =>
                setProject((current) => ({ ...current, consentGranted }))
              }
              consentError={errors.consent}
            />
            {organizationDisclosure}
          </div>
        );

      default:
        return null;
    }
  };

  /* Numbering counts the visible steps, so it stays true whichever mode is
     active and whether or not the data step is present. */
  const inputStepCount = steps.filter((entry) => entry.id !== "generate").length;
  const stepNumber = safeIndex + 1;

  const STEP_COPY = {
    type: {
      title: "What are you creating?",
      lead: "Pick the closest match and a design. We preselect one, so you can change it or move straight on.",
    },
    photos: {
      title: "Add your photographs",
      lead: `Take them now or choose them from your library. One is enough to see a proof; ${QUICK_PROOF_PHOTO_LIMIT} fills the sample.`,
    },
    details: {
      title: "Add details, or skip straight to your proof",
      lead: "Everything on this screen is optional. A proof built from photographs alone is a perfectly good proof.",
    },
    content: {
      title: "Add your spreadsheet and photographs",
      lead: "Start from our CSV template and your data will merge without cleanup. Already have a spreadsheet? Upload it and we will help you map the columns.",
    },
    data: {
      title: project.data.mappingConfirmed ? "What we found in your data" : "Match your columns to ours",
      lead: project.data.mappingConfirmed
        ? "Parsed in your browser, nothing uploaded. Here is what merged cleanly and what needs your attention."
        : "Your spreadsheet uses its own column names. Confirm what each one means — we never guess on your behalf.",
    },
    review: {
      title: "Review your submission",
      lead: "Check the details below, confirm you have permission to share this content, and we will build your proof.",
    },
  };

  const copy = STEP_COPY[step.id];
  const isResults = step.id === "generate" && result && !renderError;

  return (
    <div style={IP.page}>
      <style>{IP_CSS}</style>

      <ProofHeader />

      <main style={{ flex: 1 }}>
        {/* Intro — shown only on the first step, so returning visitors are not
            asked to scroll past the pitch on every step. */}
        {safeIndex === 0 && (
          <section
            style={{
              background: PALETTE.ink,
              color: PALETTE.white,
              padding: `clamp(3rem, 8vw, 5rem) ${PAGE_X}`,
            }}
          >
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <p style={{ ...IP.eyebrow, color: PALETTE.accent }}>Pressmark Instant Proof</p>
              <h1
                style={{
                  fontFamily: FONT_STACK,
                  fontSize: "clamp(2.3rem, 6vw, 4rem)",
                  fontWeight: 900,
                  lineHeight: 1.05,
                  margin: "0 0 1.2rem",
                  maxWidth: 900,
                }}
              >
                See Your Publication Before You Hire Us
              </h1>
              <p
                style={{
                  fontSize: "clamp(1rem, 2.1vw, 1.2rem)",
                  lineHeight: 1.75,
                  color: PALETTE.textOnDark,
                  margin: "0 0 1.8rem",
                  maxWidth: 640,
                }}
              >
                Upload a small portion of your content and Pressmark's automated production system
                will transform it into a professionally designed publication proof.
              </p>
              <a
                href="#proof-steps"
                className="ip-btn-primary"
                style={IP.btnPrimary}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById("proof-steps")?.scrollIntoView({ behavior: "smooth" });
                  headingRef.current?.focus();
                }}
              >
                Create My Free Publication Proof
              </a>
              <p
                style={{
                  marginTop: "1.4rem",
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                  color: PALETTE.textOnDarkMuted,
                  maxWidth: 520,
                }}
              >
                Your sample is private and automatically removed after 48 hours.
              </p>
            </div>
          </section>
        )}

        <div id="proof-steps" style={{ ...IP.container, ...IP.section }}>
          {!isResults && <ProofStepper steps={steps} currentIndex={safeIndex} />}

          {step.id === "generate" ? (
            <div style={{ paddingTop: "2rem" }}>
              {isResults ? (
                <ProofResults
                  project={project}
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
              ) : (
                <>
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    style={{ ...IP.stepTitle, outline: "none" }}
                  >
                    Building your proof
                  </h2>
                  <ProofProcessing
                    status={status}
                    simulated={renderer.isSimulated}
                    error={renderError}
                    onRetry={startRender}
                  />
                </>
              )}
            </div>
          ) : (
            <div style={{ paddingTop: "2rem" }}>
              <p style={IP.eyebrow}>
                Step {stepNumber} of {inputStepCount}
              </p>
              <h2 ref={headingRef} tabIndex={-1} style={{ ...IP.stepTitle, outline: "none" }}>
                {copy.title}
              </h2>
              <p style={IP.stepLead}>{copy.lead}</p>

              {stepContent()}

              <div
                className="ip-nav-row"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  marginTop: "2.5rem",
                  paddingTop: "1.75rem",
                  borderTop: `1px solid ${PALETTE.hairline}`,
                }}
              >
                {safeIndex > 0 ? (
                  <button type="button" className="ip-btn-ghost ip-touch" style={IP.btnGhost} onClick={back}>
                    ← Back
                  </button>
                ) : (
                  <span />
                )}

                <span style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {/* The details step is genuinely optional, so say so with a
                      control rather than only with words. */}
                  {step.id === "photos" && (
                    <button type="button" className="ip-btn-ghost ip-touch" style={IP.btnGhost} onClick={skipToProof}>
                      Skip to my proof →
                    </button>
                  )}
                  <button type="button" className="ip-btn-primary ip-touch" style={IP.btnPrimary} onClick={next}>
                    {isLastInput ? "Generate My Proof →" : "Continue →"}
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>
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
