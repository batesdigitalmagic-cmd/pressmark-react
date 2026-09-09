/*
 * Projecting a mapped record set down to the directory worker's CSV contract.
 *
 * ── Why this file exists ──
 *
 * There are two directory schemas in this repository and they do not agree:
 *
 *   csv/schemas.js `people-directory`  17 columns, requires record_id and
 *                                      display_name, carries photo_filename,
 *                                      city/state/postal, title, bio, sort order.
 *
 *   lib/render-jobs/csv.js             8 columns, requires last_name and
 *                                      first_name, rejects EVERY other header
 *                                      outright.
 *
 * That disagreement was not cosmetic: the people-directory CSV template this
 * site offers for download was rejected by the very endpoint it feeds, with
 * "Unsupported headers: record_id, display_name, title, ...". Anyone following
 * our own instructions hit a hard 400.
 *
 * Rather than narrow the browser (which would cost photo matching, sort order
 * and the whole alias-driven mapping UI) or widen the worker (which would move
 * the problem into the InDesign script), the browser keeps the rich schema and
 * *projects* it here, immediately before submission. The customer's spreadsheet
 * can be as rich as they like; the worker receives exactly the eight columns it
 * accepts, already mapped and already sorted.
 *
 * The rich record set stays the source of truth for the on-screen proof, so the
 * preview shows titles and portraits even though the production CSV cannot
 * carry them.
 *
 * Pure and browser-only. It imports nothing from lib/ or api/ — eslint.config.js
 * forbids that — so the header list below is duplicated deliberately. The
 * verification script asserts the two stay identical.
 */

import { sortRecords } from "./analyzeRecords.js";
import { resolveBinding } from "../render/bindings.js";

/*
 * The worker's contract, mirrored. Must stay byte-identical to REQUIRED_HEADERS
 * and OPTIONAL_HEADERS in lib/render-jobs/csv.js; verify:proof fails if it drifts.
 */
export const WORKER_REQUIRED_HEADERS = ["last_name", "first_name"];
export const WORKER_OPTIONAL_HEADERS = [
  "address",
  "phone",
  "alternate_phone",
  "email",
  "alternate_email",
  "family_members",
];
export const WORKER_HEADERS = [...WORKER_REQUIRED_HEADERS, ...WORKER_OPTIONAL_HEADERS];

const text = (value) => String(value ?? "").trim();

/* resolveBinding answers {kind, value}; every field read here is text. */
const bind = (expression, record, schema) =>
  text(resolveBinding(expression, { record, schema })?.value);

/**
 * Split a single display name into surname and forename.
 *
 * A directory display name is written one of two ways, and the comma is what
 * tells them apart:
 *
 *   "Whitfield, Ava"   already inverted for alphabetical listing  -> last, first
 *   "Ava Whitfield"    natural order                              -> first, last
 *
 * The last whitespace-separated word is taken as the surname in the natural
 * case, so "Ava Marie Whitfield" keeps "Ava Marie" together as the forename
 * rather than losing the middle name. A single word is treated as a surname,
 * because a directory sorts on it.
 */
export function splitDisplayName(displayName) {
  const value = text(displayName);
  if (!value) return { last: "", first: "" };

  const comma = value.indexOf(",");
  if (comma !== -1) {
    return {
      last: value.slice(0, comma).trim(),
      first: value.slice(comma + 1).trim(),
    };
  }

  const parts = value.split(/\s+/);
  if (parts.length === 1) return { last: parts[0], first: "" };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") };
}

/**
 * Surname and forename for one record.
 *
 * Explicit first_name/last_name columns win, because the customer stated them.
 * Only when a spreadsheet carries display_name alone do we split it — and a
 * record with just one of the two explicit columns still gets the other
 * inferred, so a sheet holding only `last_name` is not rejected for a missing
 * `first_name` it never had.
 */
export function namePartsOf(record, schema) {
  const first = bind("role:firstName", record, schema);
  const last = bind("role:lastName", record, schema);
  if (first && last) return { first, last };

  const split = splitDisplayName(bind("role:primaryText", record, schema));
  return { first: first || split.first, last: last || split.last };
}

/*
 * One address line, because the worker has one address column.
 *
 * The rich schema keeps street, city, state and postcode apart so the proof can
 * give each its own reserved line. The worker cannot express that, so they are
 * rejoined the way an envelope is written: street, then locality.
 */
function addressOf(record, schema) {
  const street = bind("streetAddress", record, schema);
  const locality = bind("cityStateLine", record, schema);
  return [street, locality].filter(Boolean).join(", ");
}

/**
 * Build the worker's row for one record. Values only — never a header.
 *
 * `alternate_phone`, `alternate_email` and `family_members` have no counterpart
 * in the rich schema, so they are deliberately empty rather than guessed at. A
 * fabricated second phone number would print in someone's directory.
 */
function workerRow(record, schema) {
  const { first, last } = namePartsOf(record, schema);
  return {
    last_name: last,
    first_name: first,
    address: addressOf(record, schema),
    phone: bind("role:phone", record, schema),
    alternate_phone: "",
    email: bind("role:email", record, schema),
    alternate_email: "",
    family_members: "",
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
 * them here means we can name the rows instead.
 *
 * @returns {{index: number, reason: string}[]}
 */
export function unexportableRecords(records, schema) {
  const problems = [];
  sortRecords(records ?? []).forEach((record, index) => {
    const { first, last } = namePartsOf(record, schema);
    if (!last && !first) {
      problems.push({ index, reason: "no name in any recognised column" });
    } else if (!last) {
      problems.push({ index, reason: "no surname" });
    } else if (!first) {
      problems.push({ index, reason: "no first name" });
    }
  });
  return problems;
}

/**
 * The production CSV, as text.
 *
 * Sorted by sort_order then file order (the same order the on-screen proof
 * uses, so the preview and the PDF agree), then re-sorted by the server into
 * surname order. Only columns that actually carry a value are emitted: every
 * optional header is optional to the worker, and shipping four empty columns
 * would suggest we lost data we never had.
 *
 * Records without a usable name are dropped rather than allowed to fail the
 * whole upload; `unexportableRecords` is what tells the customer about them.
 *
 * @param {Record<string,string>[]} records  Canonical, mapped records.
 * @param {import('./schemas.js').ContentSchema} schema
 * @returns {{text: string, rowCount: number, headers: string[], skipped: number}}
 */
export function toDirectoryCsv(records, schema) {
  const rows = sortRecords(records ?? [])
    .map((record) => workerRow(record, schema))
    /* Both names are required by the worker; infer the missing half from the
       one we have rather than discarding a real person over a blank column. */
    .map((row) => {
      if (row.last_name && !row.first_name) return { ...row, first_name: row.last_name };
      if (!row.last_name && row.first_name) return { ...row, last_name: row.first_name };
      return row;
    })
    .filter((row) => row.last_name && row.first_name);

  const headers = WORKER_HEADERS.filter(
    (header) =>
      WORKER_REQUIRED_HEADERS.includes(header) || rows.some((row) => row[header] !== "")
  );

  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(","));

  return {
    text: `${lines.join("\r\n")}\r\n`,
    rowCount: rows.length,
    headers,
    skipped: sortRecords(records ?? []).length - rows.length,
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
