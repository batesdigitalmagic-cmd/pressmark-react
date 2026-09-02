/*
 * Filename matching — linking CSV image references to uploaded photographs.
 *
 * ── Why the rules are this strict ──
 *
 * Loose matching is how the wrong student's face ends up under the wrong name.
 * "smith_j.jpg" and "smith_jane.jpg" are a partial match and a coin flip. So:
 *
 *   1. Exact filename match.
 *   2. Failing that, case-insensitive match (Windows exports vs. macOS uploads
 *      differ in case constantly, and the file is unambiguously the same one).
 *   3. Nothing else is automatic. No stem matching, no fuzzy distance, no
 *      "closest" guess.
 *
 * Anything unresolved is reported and offered to the customer for manual
 * selection, which is the only safe way to close the gap.
 */

/**
 * @typedef {object} PhotoMatch
 * @property {Record<string,string>} record
 * @property {number} rowNumber
 * @property {string} requested        The filename the CSV asked for.
 * @property {import('../models.js').UploadedAsset|null} asset
 * @property {'exact'|'insensitive'|'manual'|'missing'|'none'} how
 */

/**
 * @typedef {object} PhotoMatchReport
 * @property {PhotoMatch[]} matches
 * @property {number} exact
 * @property {number} insensitive
 * @property {number} manual
 * @property {number} unmatched        Records naming a file we do not have.
 * @property {number} withoutReference Records naming no file at all.
 * @property {import('../models.js').UploadedAsset[]} unused
 * @property {{filename: string, rows: number[]}[]} duplicates
 */

/**
 * @param {Record<string,string>[]} records  Canonical rows.
 * @param {string} imageField                Canonical column holding the filename.
 * @param {import('../models.js').UploadedAsset[]} assets  Uploaded images.
 * @param {Record<string,string>} [overrides] rowKey → asset id, from manual selection.
 * @returns {PhotoMatchReport}
 */
export function matchPhotos(records, imageField, assets, overrides = {}) {
  const byExact = new Map();
  const byLower = new Map();
  for (const asset of assets) {
    if (!byExact.has(asset.name)) byExact.set(asset.name, asset);
    const lower = asset.name.toLowerCase();
    if (!byLower.has(lower)) byLower.set(lower, asset);
  }
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  const usedAssetIds = new Set();
  /** @type {Map<string, number[]>} */
  const referenceRows = new Map();
  /** @type {PhotoMatch[]} */
  const matches = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const requested = String(record[imageField] ?? "").trim();

    if (!requested) {
      matches.push({ record, rowNumber, requested: "", asset: null, how: "missing" });
      return;
    }

    if (!referenceRows.has(requested)) referenceRows.set(requested, []);
    referenceRows.get(requested).push(rowNumber);

    /* A manual selection always wins — the customer looked at it. */
    const overrideId = overrides[String(record.__rowKey ?? rowNumber)];
    if (overrideId && byId.has(overrideId)) {
      const asset = byId.get(overrideId);
      usedAssetIds.add(asset.id);
      matches.push({ record, rowNumber, requested, asset, how: "manual" });
      return;
    }

    const exact = byExact.get(requested);
    if (exact) {
      usedAssetIds.add(exact.id);
      matches.push({ record, rowNumber, requested, asset: exact, how: "exact" });
      return;
    }

    const insensitive = byLower.get(requested.toLowerCase());
    if (insensitive) {
      usedAssetIds.add(insensitive.id);
      matches.push({ record, rowNumber, requested, asset: insensitive, how: "insensitive" });
      return;
    }

    matches.push({ record, rowNumber, requested, asset: null, how: "none" });
  });

  const duplicates = [];
  for (const [filename, rows] of referenceRows) {
    if (rows.length > 1) duplicates.push({ filename, rows });
  }

  const count = (how) => matches.filter((match) => match.how === how).length;

  return {
    matches,
    exact: count("exact"),
    insensitive: count("insensitive"),
    manual: count("manual"),
    unmatched: count("none"),
    withoutReference: count("missing"),
    unused: assets.filter((asset) => !usedAssetIds.has(asset.id)),
    duplicates,
  };
}

/** Turn a match report into ProductionWarning objects for the report panel. */
export function warningsFromMatching(report, imageLabel = "photograph") {
  const warnings = [];

  if (report.unmatched > 0) {
    warnings.push({
      id: "unmatched-records",
      severity: "caution",
      message: `${report.unmatched} record${report.unmatched === 1 ? " names" : "s name"} a file that was not uploaded.`,
      detail:
        "The filename in your spreadsheet has no matching image. Check for a typo or a missing extension, or select the image manually.",
    });
  }

  if (report.insensitive > 0) {
    warnings.push({
      id: "case-insensitive-matches",
      severity: "info",
      message: `${report.insensitive} ${imageLabel}${report.insensitive === 1 ? "" : "s"} matched only after ignoring capitalization.`,
      detail:
        "Your spreadsheet and your filenames disagree on case. Harmless here, but it breaks on case-sensitive systems — worth correcting before production.",
    });
  }

  if (report.unused.length > 0) {
    warnings.push({
      id: "unused-photos",
      severity: "info",
      message: `${report.unused.length} uploaded ${imageLabel}${report.unused.length === 1 ? " is" : "s are"} not referenced by any record.`,
      detail: `${report.unused.slice(0, 6).map((asset) => asset.name).join(", ")}${report.unused.length > 6 ? ", and more" : ""}. These will not appear in the sample.`,
    });
  }

  if (report.duplicates.length > 0) {
    warnings.push({
      id: "duplicate-references",
      severity: "caution",
      message: `${report.duplicates.length} ${imageLabel}${report.duplicates.length === 1 ? " is" : "s are"} referenced by more than one record.`,
      detail: report.duplicates
        .slice(0, 4)
        .map((entry) => `"${entry.filename}" on rows ${entry.rows.join(", ")}`)
        .join("; ") + ". Usually a copy-paste error in the spreadsheet.",
    });
  }

  return warnings;
}
