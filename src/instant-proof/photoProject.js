/*
 * Quick Photo Proof — turning uploaded photographs into something the existing
 * engine can render.
 *
 * ── The idea ──
 *
 * Rather than fork the renderer for a photo-only mode, each photograph becomes
 * one synthetic record shaped like a `people-directory` row:
 *
 *   { record_id, display_name, title, category, short_bio, photo_filename }
 *
 * `photo_filename` is the asset's own name, so photoMatching.js resolves it by
 * exact match with no special-casing. planProof, the schemas, the templates and
 * the production report all work unchanged. The whole Quick Proof mode is a
 * data adapter, not a second rendering path.
 *
 * ── Empty fields ──
 *
 * A detail the visitor did not fill in is simply absent from the record. The
 * renderer already skips a binding that resolves to nothing, so a photograph
 * with no name produces no name element — not "Name", not "Unknown", not an
 * empty reserved box. That is what makes a photographs-only proof read as a
 * photography book rather than a form with blanks in it.
 */

import { ASSET_KINDS, PROOF_MODES, hasPhotoDetails } from "./models.js";

/* How many photographs a Quick Proof sample places. Both shipped photo-capable
   designs hold at least this many, and the spec asks for twelve. */
export const QUICK_PROOF_PHOTO_LIMIT = 12;

/** Photographs from a project's assets, in the order they were added. */
export const photosOf = (project) =>
  (project?.assets ?? []).filter((asset) => asset.kind === ASSET_KINDS.image);

/**
 * The photographs that will actually appear in the sample.
 *
 * A visitor who adds thirty photographs is told which ones are used rather
 * than silently losing eighteen of them; `selectedPhotoIds` lets them choose.
 * With no explicit selection, the first twelve are used, in order.
 */
export function photosForProof(project, limit = QUICK_PROOF_PHOTO_LIMIT) {
  const photos = photosOf(project);
  const selected = project?.selectedPhotoIds;

  if (Array.isArray(selected) && selected.length > 0) {
    const chosen = photos.filter((photo) => selected.includes(photo.id));
    if (chosen.length > 0) return chosen.slice(0, limit);
  }
  return photos.slice(0, limit);
}

/**
 * Build one record per photograph.
 *
 * Only fields the visitor actually supplied are written. An absent key is
 * absent from the record entirely, which is what lets the renderer collapse it.
 *
 * @param {import('./models.js').ProofProject} project
 * @returns {Record<string,string>[]}
 */
export function photoRecords(project, limit = QUICK_PROOF_PHOTO_LIMIT) {
  return photosForProof(project, limit).map((asset, index) => {
    const details = asset.details ?? {};
    /** @type {Record<string,string>} */
    const record = {
      record_id: asset.id,
      photo_filename: asset.name,
      sort_order: String(index + 1),
    };

    const set = (key, value) => {
      const trimmed = String(value ?? "").trim();
      if (trimmed) record[key] = trimmed;
    };

    set("display_name", details.displayName);
    set("title", details.title);
    set("category", details.category);
    /* The caption maps to short_bio, which is the schema's bodyText role — the
       field a template binds to for descriptive copy. */
    set("short_bio", details.caption);

    return record;
  });
}

/** True when at least one photograph carries any optional detail. */
export const hasAnyPhotoDetails = (project) =>
  photosOf(project).some((asset) => hasPhotoDetails(asset.details));

/**
 * Which design a Quick Proof should use.
 *
 * With no names or titles anywhere, a structured directory layout would print
 * rows of empty bands under each portrait. The photo-led design gives that
 * space back to the photographs instead. Once any detail exists, the structured
 * layout is the better answer because there is something to structure.
 *
 * Only consulted when the visitor has not chosen a template themselves.
 */
export const suggestsPhotoLedDesign = (project) =>
  project?.mode === PROOF_MODES.photo && !hasAnyPhotoDetails(project);

/**
 * The records a project renders from, whichever mode it is in.
 * One entry point so the mockup, the renderer and the report cannot disagree.
 */
export function recordsFor(project) {
  if (project?.mode === PROOF_MODES.photo) return photoRecords(project);
  return project?.data?.records ?? [];
}
