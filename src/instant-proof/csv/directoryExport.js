/*
 * Projecting mapped Directory Classic records onto the worker's CSV contract.
 *
 * ── What this is now ──
 *
 * The browser schema (`church-directory`) and the worker contract are the same
 * eight columns, in the same meaning, because both were derived from the merge
 * fields of church-directory-classic.indd. This module's job is therefore no
 * longer to translate between two disagreeing schemas — it is to emit those
 * eight columns in the exact shape the InDesign script requires.
 *
 * ── Values are passed through, never invented ──
 *
 * Every cell is the customer's own value. There is no display-name splitting,
 * no record id, no inferring a forename from a surname, and no substituting one
 * column for another. An earlier version did the last of these — a row with a
 * surname and no forename had the surname copied into `first_name` so the
 * upload would pass — which quietly printed the wrong thing in someone's
 * directory. A row that cannot be printed honestly is reported instead.
 *
 * ── All eight headers, always ──
 *
 * PressmarkDirectoryMerge.jsx validates that ALL EIGHT headers are present and
 * fails the render if any is missing. This module previously omitted optional
 * columns that were empty for every row, so a directory where nobody had an
 * alternate phone produced a seven-column CSV and a failed render. The header
 * row is now fixed and complete; empty cells are empty, which is what Data
 * Merge expects.
 *
 * Pure and browser-only. It imports nothing from lib/ or api/ — eslint forbids
 * that — so the header list below is duplicated deliberately, and verify:proof
 * asserts it still matches lib/render-jobs/csv.js.
 */

import { sortRecords } from "./analyzeRecords.js";
import { resolveBinding } from "../render/bindings.js";

/*
 * The worker's contract, mirrored. Must stay byte-identical to REQUIRED_HEADERS
 * and OPTIONAL_HEADERS in lib/render-jobs/csv.js, and to REQUIRED_HEADERS in
 * scripts/indesign/PressmarkDirectoryMerge.jsx.
 */
export const WORKER_REQUIRED_HEADERS = ["last_name", "first_name", "address", "phone", "email"];
export const WORKER_OPTIONAL_HEADERS = ["alternate_phone", "alternate_email", "family_members"];

/*
 * The header row, in the order the InDesign template expects. Every one is
 * emitted on every export — see the note above about the JSX requiring all
 * eight.
 */
export const WORKER_HEADERS = [
  "last_name",
  "first_name",
  "address",
  "phone",
  "alternate_phone",
  "email",
  "alternate_email",
  "family_members",
];

const text = (value) => String(value ?? "").trim();

/* resolveBinding answers {kind, value}; every field read here is text. */
const bind = (expression, record, schema) =>
  text(resolveBinding(expression, { record, schema })?.value);

/**
 * The worker's row for one record — the customer's values, unchanged.
 *
 * Each cell reads through its semantic role, so a customer who mapped
 * "Home Phone" to `phone` gets their own value in the phone column without this
 * module knowing what they called it.
 */
function workerRow(record, schema) {
  return {
    last_name: bind("role:lastName", record, schema),
    first_name: bind("role:firstName", record, schema),
    address: bind("role:addressLine", record, schema),
    phone: bind("role:phone", record, schema),
    alternate_phone: bind("role:altPhone", record, schema),
    email: bind("role:email", record, schema),
    alternate_email: bind("role:altEmail", record, schema),
    family_members: bind("role:familyMembers", record, schema),
  };
}

/** RFC 4180 quoting: only when the value actually needs it. */
function csvCell(value) {
  const cell = String(value ?? "");
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/**
 * Records the worker cannot accept, with the reason, for the UI to show before
 * anything is submitted.
 *
 * The server rejects the whole upload if a single row lacks a name, which from
 * the customer's side is one opaque 400 for a problem in row 84 of 300. Finding
 * them here means we can name the rows instead — and, crucially, we report them
 * rather than papering over them by copying a value from another column.
 *
 * @returns {{index: number, reason: string}[]}
 */
export function unexportableRecords(records, schema) {
  const problems = [];
  sortRecords(records ?? []).forEach((record, index) => {
    const row = workerRow(record, schema);
    const missing = WORKER_REQUIRED_HEADERS.filter((header) => row[header] === "");
    if (missing.length > 0) {
      problems.push({ index, reason: `no ${missing.join(", ")}` });
    }
  });
  return problems;
}

/**
 * The production CSV, as text.
 *
 * Sorted by sort order then file order — the same order the on-screen proof
 * uses, so the preview and the PDF agree — then re-sorted by the server into
 * surname order.
 *
 * Rows missing a required value are dropped rather than allowed to fail the
 * whole upload; `unexportableRecords` is what tells the customer about them.
 *
 * @param {Record<string,string>[]} records  Canonical, mapped records.
 * @param {import('./schemas.js').ContentSchema} schema
 * @returns {{text: string, rowCount: number, headers: string[], skipped: number}}
 */
export function toDirectoryCsv(records, schema) {
  const sorted = sortRecords(records ?? []);
  const rows = sorted
    .map((record) => workerRow(record, schema))
    .filter((row) => WORKER_REQUIRED_HEADERS.every((header) => row[header] !== ""));

  const lines = [WORKER_HEADERS.join(",")];
  for (const row of rows) lines.push(WORKER_HEADERS.map((header) => csvCell(row[header])).join(","));

  return {
    text: `${lines.join("\r\n")}\r\n`,
    rowCount: rows.length,
    headers: [...WORKER_HEADERS],
    skipped: sorted.length - rows.length,
  };
}

/**
 * The same CSV as a File, ready to POST.
 *
 * Named after the customer's own upload so the job is recognisable to them and
 * to whoever opens it on the production side.
 */
export function toDirectoryCsvFile(records, schema, originalName = "directory.csv") {
  const built = toDirectoryCsv(records, schema);
  const base = originalName.replace(/\.csv$/i, "") || "directory";
  const file = new File([built.text], `${base}-pressmark.csv`, { type: "text/csv" });
  return { file, ...built };
}
