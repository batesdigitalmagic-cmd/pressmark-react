/*
 * Record validation.
 *
 * Runs entirely in the browser over already-parsed, already-mapped rows.
 * Reports problems; never mutates or "fixes" the customer's data. The goal is
 * that a customer sees the same issues we would have found in production,
 * before they pay us to find them.
 */

import { fieldOf, requiredColumnsOf, schemaFor } from "./schemas.js";

/**
 * @typedef {object} RecordIssue
 * @property {string} id
 * @property {'error'|'warning'|'info'} severity
 * @property {string} message
 * @property {string} [detail]
 * @property {number[]} [rows]   1-based data row numbers, for pointing the customer at them.
 */

/* Row numbers shown to the customer are 1-based over data rows, matching what
   a spreadsheet shows once the header is accounted for. */
const displayRow = (index) => index + 2;

/** Cap the row list in a message so one bad export does not produce a wall of numbers. */
const summarizeRows = (rows, limit = 8) => {
  if (rows.length === 0) return "";
  const shown = rows.slice(0, limit).join(", ");
  return rows.length > limit ? `Rows ${shown} and ${rows.length - limit} more.` : `Row${rows.length === 1 ? "" : "s"} ${shown}.`;
};

/**
 * @param {Record<string,string>[]} records  Canonical rows (post-mapping).
 * @param {string} schemaId
 * @param {string[]} suppliedHeaders         The customer's original headers.
 * @param {string[]} mappedHeaders           Headers that were mapped to a field.
 * @returns {{issues: RecordIssue[], stats: object}}
 */
export function analyzeRecords(records, schemaId, suppliedHeaders = [], mappedHeaders = []) {
  const schema = schemaFor(schemaId);
  /** @type {RecordIssue[]} */
  const issues = [];

  if (!schema) {
    return { issues, stats: { total: records.length } };
  }

  const present = new Set();
  for (const record of records) {
    for (const key of Object.keys(record)) present.add(key);
  }

  /* ── Missing required columns ── */
  const required = requiredColumnsOf(schema);
  const missingColumns = required.filter((key) => !present.has(key));
  if (missingColumns.length > 0) {
    issues.push({
      id: "missing-required-columns",
      severity: "error",
      message: `${missingColumns.length === 1 ? "A required column is" : `${missingColumns.length} required columns are`} missing.`,
      detail: `Pressmark needs ${missingColumns
        .map((key) => fieldOf(schema, key)?.label ?? key)
        .join(", ")}. Map an existing column to it, or add it to your spreadsheet.`,
    });
  }

  /* ── Empty values in required columns ── */
  for (const key of required) {
    if (!present.has(key)) continue;
    const blanks = [];
    records.forEach((record, index) => {
      if (!String(record[key] ?? "").trim()) blanks.push(displayRow(index));
    });
    if (blanks.length > 0) {
      issues.push({
        id: `empty-required-${key}`,
        severity: "error",
        message: `${blanks.length} row${blanks.length === 1 ? " is" : "s are"} missing ${fieldOf(schema, key)?.label ?? key}.`,
        detail: summarizeRows(blanks),
        rows: blanks,
      });
    }
  }

  /* ── Duplicate record IDs ── */
  const idField = schema.fields.find((field) => field.role === "recordId");
  const duplicateIds = [];
  if (idField && present.has(idField.key)) {
    /** @type {Map<string, number[]>} */
    const seen = new Map();
    records.forEach((record, index) => {
      const value = String(record[idField.key] ?? "").trim();
      if (!value) return;
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value).push(displayRow(index));
    });
    for (const [value, rows] of seen) {
      if (rows.length > 1) duplicateIds.push({ value, rows });
    }
    if (duplicateIds.length > 0) {
      issues.push({
        id: "duplicate-record-ids",
        severity: "error",
        message: `${duplicateIds.length} duplicate ${fieldOf(schema, idField.key)?.label ?? "record ID"}${duplicateIds.length === 1 ? "" : "s"}.`,
        detail: duplicateIds
          .slice(0, 5)
          .map((entry) => `"${entry.value}" appears on rows ${entry.rows.join(", ")}`)
          .join("; ") + ". Record IDs must be unique — duplicates make it impossible to tell two records apart.",
        rows: duplicateIds.flatMap((entry) => entry.rows),
      });
    }
  }

  /* ── Duplicate sort order ── */
  const duplicateSort = [];
  if (present.has("sort_order")) {
    /** @type {Map<string, number[]>} */
    const seen = new Map();
    records.forEach((record, index) => {
      const value = String(record.sort_order ?? "").trim();
      if (!value) return;
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value).push(displayRow(index));
    });
    for (const [value, rows] of seen) {
      if (rows.length > 1) duplicateSort.push({ value, rows });
    }
    if (duplicateSort.length > 0) {
      issues.push({
        id: "duplicate-sort-order",
        severity: "warning",
        message: `${duplicateSort.length} duplicate sort-order value${duplicateSort.length === 1 ? "" : "s"}.`,
        detail:
          "Records sharing a sort order fall back to the order they appear in the file, which may not be what you intend.",
        rows: duplicateSort.flatMap((entry) => entry.rows),
      });
    }
  }

  /* ── Rows with no image filename ── */
  const imageField = schema.imageField;
  let missingPhotoRows = [];
  if (imageField && present.has(imageField)) {
    records.forEach((record, index) => {
      if (!String(record[imageField] ?? "").trim()) missingPhotoRows.push(displayRow(index));
    });
    if (missingPhotoRows.length > 0) {
      issues.push({
        id: "rows-missing-photo",
        severity: "warning",
        message: `${missingPhotoRows.length} row${missingPhotoRows.length === 1 ? " has" : "s have"} no ${fieldOf(schema, imageField)?.label ?? "image filename"}.`,
        detail:
          "Pressmark places a styled placeholder for these so the layout stays even. " + summarizeRows(missingPhotoRows),
        rows: missingPhotoRows,
      });
    }
  } else if (imageField) {
    issues.push({
      id: "no-photo-column",
      severity: "info",
      message: "No image filename column was supplied.",
      detail: `Add a ${fieldOf(schema, imageField)?.label ?? "photo filename"} column to link your photographs to these records.`,
    });
  }

  /* ── Columns we did not recognize ── */
  const unrecognized = suppliedHeaders.filter((header) => !mappedHeaders.includes(header));
  if (unrecognized.length > 0) {
    issues.push({
      id: "unrecognized-columns",
      severity: "info",
      message: `${unrecognized.length} column${unrecognized.length === 1 ? "" : "s"} not used by this template.`,
      detail: `${unrecognized.join(", ")}. Your data is kept — these columns simply have no place in the sample layout. Map one to a Pressmark field if it should appear.`,
    });
  }

  if (records.length === 0) {
    issues.push({
      id: "no-records",
      severity: "error",
      message: "No data rows were found in the file.",
      detail: "The file may contain only a header row, or may not be a CSV.",
    });
  }

  return {
    issues,
    stats: {
      total: records.length,
      duplicateIds: duplicateIds.length,
      duplicateSortOrder: duplicateSort.length,
      missingPhotoRows: missingPhotoRows.length,
      missingColumns,
      unrecognized,
    },
  };
}

/** Sort records by sort_order when present, stable-falling back to file order. */
export function sortRecords(records) {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const av = Number.parseFloat(a.record.sort_order);
      const bv = Number.parseFloat(b.record.sort_order);
      const aHas = Number.isFinite(av);
      const bHas = Number.isFinite(bv);
      if (aHas && bHas && av !== bv) return av - bv;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.record);
}
