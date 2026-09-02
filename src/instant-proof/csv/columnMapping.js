/*
 * Column mapping — reconciling a customer's spreadsheet with a Pressmark schema.
 *
 * Customers arrive with headers like "Member Name", "Job Title", "Photo". This
 * module proposes what those probably mean and reports how confident it is.
 *
 * ── The one rule that matters ──
 *
 * A suggestion is never silently applied. `suggestMapping()` returns proposals
 * with a confidence level; the UI shows them and the customer confirms. A wrong
 * mapping applied quietly would put job titles where names belong across an
 * entire publication, and nobody would notice until it was printed.
 *
 * Confidence levels:
 *   exact   — the header already *is* the canonical column name. Safe to apply.
 *   strong  — a known alias, unambiguous. Pre-selected, still shown for review.
 *   weak    — a known alias that more than one field claims. Pre-selected as the
 *             best guess but flagged, because this is where mistakes live.
 *   none    — no idea. Left unmapped for the customer to decide.
 */

import { schemaFor } from "./schemas.js";

/** Normalize a header for comparison: lowercase, collapse separators. */
export const normalizeHeader = (header) =>
  String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, " ")
    .replace(/\s+/g, " ");

/**
 * @typedef {object} MappingProposal
 * @property {string} header        The customer's header, as it appears.
 * @property {string|null} field    Proposed canonical field key, or null.
 * @property {'exact'|'strong'|'weak'|'none'} confidence
 * @property {string[]} alternatives Other fields that also claimed this header.
 */

/**
 * Propose a field for every header in the uploaded file.
 *
 * @param {string[]} headers
 * @param {string} schemaId
 * @returns {MappingProposal[]}
 */
export function suggestMapping(headers, schemaId) {
  const schema = schemaFor(schemaId);
  if (!schema) return headers.map((header) => ({ header, field: null, confidence: "none", alternatives: [] }));

  /* Build a lookup once: normalized spelling → the fields that claim it. */
  /** @type {Map<string, {key: string, exact: boolean}[]>} */
  const claims = new Map();
  const claim = (spelling, key, exact) => {
    const normalized = normalizeHeader(spelling);
    if (!normalized) return;
    if (!claims.has(normalized)) claims.set(normalized, []);
    claims.get(normalized).push({ key, exact });
  };

  for (const field of schema.fields) {
    claim(field.key, field.key, true);
    claim(field.label, field.key, false);
    for (const alias of field.aliases) claim(alias, field.key, false);
  }

  /* Fields already taken by an exact match cannot be proposed again — two
     columns mapping to display_name would silently drop one of them. */
  const takenByExact = new Set();
  for (const header of headers) {
    const matches = claims.get(normalizeHeader(header)) ?? [];
    const exact = matches.find((match) => match.exact);
    if (exact) takenByExact.add(exact.key);
  }

  const used = new Set();

  return headers.map((header) => {
    const matches = claims.get(normalizeHeader(header)) ?? [];

    const exact = matches.find((match) => match.exact);
    if (exact) {
      used.add(exact.key);
      return { header, field: exact.key, confidence: "exact", alternatives: [] };
    }

    /* Prefer a field nothing has claimed yet, so two aliases of the same field
       do not both resolve to it and quietly discard one column. */
    const candidates = matches.map((match) => match.key).filter((key) => !takenByExact.has(key));
    const unique = [...new Set(candidates)];
    const free = unique.filter((key) => !used.has(key));
    const chosen = free[0] ?? null;

    if (!chosen) {
      return { header, field: null, confidence: "none", alternatives: unique };
    }

    used.add(chosen);
    return {
      header,
      field: chosen,
      /* More than one field wanted this header — the customer must look. */
      confidence: unique.length > 1 ? "weak" : "strong",
      alternatives: unique.filter((key) => key !== chosen),
    };
  });
}

/** True when every header already carries its canonical Pressmark name. */
export const isCanonical = (proposals) =>
  proposals.length > 0 && proposals.every((proposal) => proposal.confidence === "exact");

/**
 * Build the header → field mapping a set of proposals implies.
 * @returns {Record<string,string>} header → canonical field key
 */
export const mappingFromProposals = (proposals) =>
  Object.fromEntries(proposals.filter((proposal) => proposal.field).map((proposal) => [proposal.header, proposal.field]));

/**
 * Rewrite parsed rows into canonical Pressmark columns.
 *
 * Unmapped columns are dropped from the canonical view but the original row is
 * preserved on `_source`, so nothing the customer supplied is ever lost — a
 * later phase can surface columns we did not use.
 *
 * @param {Record<string,string>[]} rows
 * @param {Record<string,string>} mapping  header → canonical field key
 * @returns {Record<string,string>[]}
 */
export function applyMapping(rows, mapping) {
  return rows.map((row) => {
    /** @type {Record<string,string>} */
    const canonical = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const value = row[header];
      if (value !== undefined && value !== "") canonical[field] = value;
    }
    Object.defineProperty(canonical, "_source", { value: row, enumerable: false });
    return canonical;
  });
}

/** Headers the customer supplied that no Pressmark field claims. */
export const unmappedHeaders = (proposals) =>
  proposals.filter((proposal) => !proposal.field).map((proposal) => proposal.header);
