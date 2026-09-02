/*
 * Proof planning — deciding what actually goes on the sample pages.
 *
 * A customer may upload 400 records. The sample shows a handful of pages, so
 * something has to choose which records appear and report honestly how many
 * did not. Doing that here, as pure data, means the renderer stays dumb and the
 * production report can quote exact numbers rather than estimates.
 *
 * Records are used in sorted order (sort_order, then file order) so the sample
 * shows the beginning of the publication, which is what a customer expects to
 * see and what makes the alphabetical flow legible.
 */

import { sortRecords } from "../csv/analyzeRecords.js";
import { recordCapacityOf } from "../templates/registry.js";

/**
 * @typedef {object} PlannedPage
 * @property {import('../templates/registry.js').TemplatePage} page
 * @property {Record<string,string>[]} records  Records bound to this page.
 */

/**
 * @typedef {object} ProofPlan
 * @property {PlannedPage[]} pages
 * @property {number} recordsAvailable
 * @property {number} recordsShown
 * @property {number} recordsOmitted
 * @property {boolean} manualMode   True when no CSV was supplied.
 */

/**
 * @param {import('../templates/registry.js').DesignTemplate} template
 * @param {Record<string,string>[]} records  Canonical, mapped records.
 * @returns {ProofPlan}
 */
export function planProof(template, records) {
  const sorted = sortRecords(records ?? []);
  const manualMode = sorted.length === 0;

  /** @type {PlannedPage[]} */
  const pages = [];
  let cursor = 0;

  for (const page of template.pages) {
    const repeaters = (page.elements ?? []).filter((element) => element.type === "repeater");

    if (repeaters.length > 0) {
      /*
       * A grid page consumes records sequentially, so a listing spread and a
       * portrait spread show different people rather than repeating the same
       * faces. The cursor advances only here.
       */
      /*
       * The highest record index any repeater on this page reaches — not the
       * sum. A spread laid out as two grids, one per page, uses startIndex to
       * split one run of records between them: grid A takes 0–5, grid B takes
       * 6–11, and the page needs 12 records, not 18. Summing would slice 18 and
       * silently skip six records at the next page.
       */
      const needed = repeaters.reduce((max, element) => {
        const { columns = 1, rows = 1 } = element.repeat ?? {};
        return Math.max(max, (element.startIndex ?? 0) + columns * rows);
      }, 0);
      const slice = sorted.slice(cursor, cursor + needed);
      pages.push({ page, records: slice });
      cursor += slice.length;
      continue;
    }

    /*
     * A page that pins records by index — a featured profile, a feature spread —
     * showcases specific people rather than continuing the sequence. It draws
     * from the START of the list and does NOT advance the cursor: "featured
     * member" means the first record, and taking it from wherever the grid
     * happened to stop would leave the page empty whenever the roster was
     * shorter than the grid.
     */
    const highest = (page.elements ?? []).reduce(
      (max, element) => (element.recordIndex !== undefined ? Math.max(max, element.recordIndex + 1) : max),
      0
    );
    pages.push({ page, records: highest > 0 ? sorted.slice(0, highest) : [] });
  }

  const capacity = recordCapacityOf(template);
  /* Featured pages re-show records the grid already placed, so the cursor is
     the honest count of how much of the roster the sample reaches. */
  const recordsShown = Math.min(sorted.length, cursor);

  return {
    pages,
    recordsAvailable: sorted.length,
    recordsShown,
    recordsOmitted: Math.max(sorted.length - recordsShown, 0),
    capacity,
    manualMode,
  };
}
