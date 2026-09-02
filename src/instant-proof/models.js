/*
 * Pressmark Instant Proof — data model.
 *
 * This repository is plain JavaScript, so "types" here are JSDoc typedefs plus
 * factory functions that guarantee shape. Editors get completion and the
 * factories keep every consumer building the same object, which is what the
 * type names in the spec are actually for. If the project ever moves to
 * TypeScript these typedefs translate one-for-one.
 *
 * Nothing in this module touches the network, the DOM, or storage — it is pure
 * data so the renderer and the UI can both depend on it without coupling.
 */

/**
 * @typedef {object} PublicationType
 * @property {string} id            Stable slug used in config lookups and analytics.
 * @property {string} label         Customer-facing name.
 * @property {string} blurb         One line shown on the selector card.
 */

/**
 * @typedef {object} ContentRequirement
 * @property {string} id
 * @property {string} label         What we are asking for ("Portrait photographs").
 * @property {string} hint          How to supply it ("10–30 JPG or PNG files").
 * @property {string[]} accept      File extensions this slot accepts, lowercase with dot.
 * @property {boolean} required
 */

/**
 * @typedef {object} PublicationConfiguration
 * @property {string} id
 * @property {string} label
 * @property {string} blurb
 * @property {string} description       Longer positioning line used in the review step.
 * @property {ContentRequirement[]} requiredContent
 * @property {ContentRequirement[]} optionalContent
 * @property {number} suggestedProofPages  Pages the proof will demonstrate.
 * @property {string[]} dataFields         CSV columns the automation reads.
 * @property {string} uploadInstructions   Shown above the drop zone.
 * @property {string} sampleOutput         "What you will receive" line for the review step.
 */

/**
 * Organization information.
 *
 * EVERY FIELD IS OPTIONAL. A visitor can generate a proof having typed nothing
 * at all — the point of the tool is to show them what Pressmark can do with
 * their photographs, and a form standing between them and that is friction we
 * were charging them for no reason.
 *
 * Contact details are not collected here at all any more. Email is asked for
 * once, at the moment a visitor asks for something that needs a reply — see
 * components/ContactRequestForm.jsx.
 *
 * @typedef {object} OrganizationInformation
 * @property {string} organizationName   Optional; falls back to a neutral label.
 * @property {string} cityState          Optional.
 * @property {string} publicationSize    Optional trim size.
 * @property {string} estimatedPageCount Optional range.
 * @property {string} deadline           Optional.
 */

/**
 * @typedef {object} VisualDirection
 * @property {string} templateId       A DESIGN_TEMPLATES id — the actual design.
 * @property {string} styleId          A STYLE_DIRECTIONS id; filter metadata only.
 * @property {string} primaryColor     Hex.
 * @property {string} secondaryColor   Hex.
 * @property {UploadedAsset|null} logo
 * @property {string} designNotes
 */

/**
 * A file the visitor added. `file` is the live browser File object and never
 * leaves memory in Phase 1 — see docs/instant-proof.md.
 *
 * @typedef {object} UploadedAsset
 * @property {string} id
 * @property {string} name
 * @property {string} extension     Lowercase with dot.
 * @property {number} size          Bytes.
 * @property {string} kind          One of ASSET_KINDS.
 * @property {File}   file
 * @property {string} [previewUrl]  Object URL for images; revoked on removal.
 * @property {PhotoDetails} [details]  Optional per-photo captions, Quick Proof only.
 */

/**
 * Optional information a visitor may attach to one photograph.
 *
 * All of it is optional by design. An empty field is not rendered at all — no
 * placeholder word, no reserved gap — so a proof built from photographs alone
 * looks like a photography book rather than a form with blanks in it.
 *
 * @typedef {object} PhotoDetails
 * @property {string} displayName
 * @property {string} title
 * @property {string} category
 * @property {string} caption
 */

/**
 * @typedef {object} ProofProject
 * @property {'photo'|'data'} mode   Quick Photo Proof, or spreadsheet-driven.
 * @property {string} publicationTypeId
 * @property {OrganizationInformation} organization
 * @property {VisualDirection} visual
 * @property {UploadedAsset[]} assets
 * @property {ProjectData} data
 * @property {boolean} consentGranted
 */

/**
 * Parsed spreadsheet content. Held in memory only — see docs/instant-proof.md.
 *
 * @typedef {object} ProjectData
 * @property {string} schemaId              CONTENT_SCHEMAS id in play.
 * @property {string} sourceAssetId         The UploadedAsset the rows came from.
 * @property {string[]} headers             Headers as supplied by the customer.
 * @property {Record<string,string>[]} rawRows      Rows keyed by the customer's headers.
 * @property {Record<string,string>[]} records      Rows keyed by canonical Pressmark columns.
 * @property {import('./csv/columnMapping.js').MappingProposal[]} proposals
 * @property {Record<string,string>} mapping        header → canonical field.
 * @property {boolean} mappingConfirmed     False until the customer approves it.
 * @property {Record<string,string>} photoOverrides rowNumber → asset id, manual picks.
 * @property {object|null} analysis         analyzeRecords() output.
 * @property {string} parseError
 */

/**
 * @typedef {object} ProofJob
 * @property {string} id
 * @property {string} publicationTypeId
 * @property {string} createdAt        ISO 8601.
 * @property {ProofJobStatus} status
 */

/**
 * @typedef {object} ProofJobStatus
 * @property {'queued'|'uploading'|'rendering'|'complete'|'failed'} state
 * @property {number} progress         0–1.
 * @property {string} stageId          Current RENDER_STAGES entry, "" when idle.
 * @property {string} message          Human-readable line for the progress panel.
 * @property {string} [error]
 */

/**
 * @typedef {object} ProductionMetric
 * @property {string} id
 * @property {string} label
 * @property {string} value
 * @property {string} [detail]
 */

/**
 * @typedef {object} ProductionWarning
 * @property {string} id
 * @property {'info'|'caution'} severity
 * @property {string} message
 * @property {string} [detail]
 */

/**
 * @typedef {object} ProofPage
 * @property {string} id
 * @property {'cover'|'spread'} kind
 * @property {string} label
 * @property {string} caption
 */

/**
 * @typedef {object} ProofResult
 * @property {string} jobId
 * @property {boolean} simulated       True whenever no real render ran.
 * @property {ProofPage[]} pages
 * @property {ProductionMetric[]} metrics
 * @property {ProductionWarning[]} warnings
 * @property {string} footerMark   Credit rendered in each page footer.
 * @property {string} expiresAt        ISO 8601.
 */

/* ── Enumerations ── */

export const ASSET_KINDS = {
  image: "image",
  data: "data",
  document: "document",
  logo: "logo",
};

export const JOB_STATES = {
  queued: "queued",
  uploading: "uploading",
  rendering: "rendering",
  complete: "complete",
  failed: "failed",
};

/*
 * The production pipeline, named once. The mock renderer walks this list to
 * drive its progress panel; a real renderer reports the same stage ids from
 * the server so the UI does not change when the backend arrives.
 */
export const RENDER_STAGES = [
  { id: "analyze", label: "Analyzing uploaded content" },
  { id: "match", label: "Matching names and photographs" },
  { id: "hierarchy", label: "Establishing publication hierarchy" },
  { id: "color", label: "Applying organization colors" },
  { id: "styles", label: "Building reusable page styles" },
  { id: "resolution", label: "Checking image resolution" },
  { id: "render", label: "Rendering the Pressmark proof" },
];

/* ── Factories ── */

/** @returns {OrganizationInformation} */
export const emptyOrganization = () => ({
  organizationName: "",
  cityState: "",
  publicationSize: "",
  estimatedPageCount: "",
  deadline: "",
});

/*
 * What a page shows when the visitor has not named their organization. Neutral
 * and obviously provisional — never "Unknown", never a blank hole.
 */
export const ORGANIZATION_FALLBACK = "Your Organization";

/** @returns {VisualDirection} */
export const emptyVisualDirection = () => ({
  templateId: "",
  styleId: "",
  primaryColor: "#1f3a5f",
  secondaryColor: "#aa7d48",
  logo: null,
  designNotes: "",
});

/** @returns {ProjectData} */
export const emptyProjectData = () => ({
  schemaId: "",
  sourceAssetId: "",
  headers: [],
  rawRows: [],
  records: [],
  proposals: [],
  mapping: {},
  mappingConfirmed: false,
  photoOverrides: {},
  analysis: null,
  parseError: "",
});

/** The two ways a proof can be built. */
export const PROOF_MODES = {
  /* Photographs only. No spreadsheet, no required fields. The default. */
  photo: "photo",
  /* The full CSV pipeline: schemas, column mapping, filename matching. */
  data: "data",
};

/** @returns {PhotoDetails} */
export const emptyPhotoDetails = () => ({
  displayName: "",
  title: "",
  category: "",
  caption: "",
});

/** True when a photo carries any detail worth rendering. */
export const hasPhotoDetails = (details) =>
  Boolean(details) &&
  [details.displayName, details.title, details.category, details.caption].some(
    (value) => String(value ?? "").trim() !== ""
  );

/** @returns {ProofProject} */
export const emptyProject = () => ({
  mode: PROOF_MODES.photo,
  publicationTypeId: "",
  organization: emptyOrganization(),
  visual: emptyVisualDirection(),
  assets: [],
  data: emptyProjectData(),
  consentGranted: false,
});

/** @returns {ProofJobStatus} */
export const idleStatus = () => ({
  state: JOB_STATES.queued,
  progress: 0,
  stageId: "",
  message: "Waiting to start",
});

/* Human-readable file size. Kept here so the upload panel and the review
   summary can never disagree about how a file is described. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extensionOf(filename) {
  const match = /\.[a-z0-9]+$/i.exec(String(filename || ""));
  return match ? match[0].toLowerCase() : "";
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const DATA_EXTENSIONS = [".csv"];

/** Classify a file by extension so metrics can count photos vs. records. */
export function kindOf(filename) {
  const ext = extensionOf(filename);
  if (IMAGE_EXTENSIONS.includes(ext)) return ASSET_KINDS.image;
  if (DATA_EXTENSIONS.includes(ext)) return ASSET_KINDS.data;
  return ASSET_KINDS.document;
}
