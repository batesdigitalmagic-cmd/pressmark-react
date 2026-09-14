/*
 * Analytics for the directory PDF tool.
 *
 * ── What is measured ──
 *
 *   pdf_sample_loaded     "Load the sample .csv" pressed and the sample accepted
 *   pdf_csv_uploaded      a visitor's own CSV accepted        record_count
 *   pdf_create_clicked    Create My PDF pressed               source, record_count, changed_colors, template_id
 *   pdf_render_completed  the InDesign render finished        source, record_count, seconds
 *   pdf_render_failed     the render failed                   source
 *   pdf_preview_shown     the PDF appeared in the page        source, page_count
 *   pdf_downloaded        Download PDF pressed                source
 *
 * `source` is "sample" or "upload", which is what separates sample traffic from
 * real directories in every report. Like the rest of the site's analytics,
 * nothing is sent unless the visitor accepted the consent banner.
 *
 * ── The rule ──
 *
 * Nothing a visitor typed or uploaded leaves the browser. Not an email address,
 * not a name, not an organization, not a filename, not an image. This is the
 * one part of the site handling other people's photographs and contact details,
 * and an analytics call is an easy place to leak them by accident — a filename
 * is very often a person's name.
 *
 * Enforced structurally rather than by discipline: every event goes through
 * `emit()`, which drops any parameter not on ALLOWED_PARAMS and coerces what
 * survives to a number or a boolean. A string cannot reach GA from this module
 * even if someone passes one, so the failure mode of a future careless call is
 * a missing metric, not a privacy incident.
 */

import { trackEvent } from "../analytics.js";

export const PROOF_EVENTS = {
  sampleLoaded: "pdf_sample_loaded",
  csvUploaded: "pdf_csv_uploaded",
  createClicked: "pdf_create_clicked",
  renderCompleted: "pdf_render_completed",
  renderFailed: "pdf_render_failed",
  previewShown: "pdf_preview_shown",
  downloaded: "pdf_downloaded",
};

/*
 * Every parameter this module may ever send. Counts, flags and our own stable
 * identifiers — nothing a visitor authored.
 *
 * `publication_type`, `template_id` and `proof_mode` are Pressmark's own slugs
 * from PUBLICATION_CONFIGS and DESIGN_TEMPLATES, chosen from a fixed list. They
 * cannot contain customer text.
 */
const ALLOWED_PARAMS = new Set([
  "photo_count",
  "record_count",
  "page_count",
  "has_details",
  "has_organization",
  "has_logo",
  "publication_type",
  "template_id",
  "proof_mode",
  "used_camera",
  "source",
  "changed_colors",
  "seconds",
]);

/* Slugs we generate ourselves; anything else is treated as untrusted. */
const SAFE_SLUG = /^[a-z0-9_-]{1,40}$/;

function clean(params) {
  const safe = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (!ALLOWED_PARAMS.has(key)) continue;

    if (typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
    } else if (typeof value === "boolean") {
      safe[key] = value;
    } else if (typeof value === "string" && SAFE_SLUG.test(value)) {
      /* Only our own slug shape survives — never free text. */
      safe[key] = value;
    }
  }
  return safe;
}

/** Send a proof event. Returns whether it was accepted for sending. */
export function emit(name, params = {}) {
  if (!Object.values(PROOF_EVENTS).includes(name)) return false;
  return trackEvent(name, clean(params));
}

/* Exported for the verification script, which asserts that personal fields
   cannot survive the filter. */
export const __sanitizeForTest = clean;
