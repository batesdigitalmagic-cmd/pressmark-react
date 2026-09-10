/*
 * Binding resolution — turning a template element's `field` expression into
 * actual content from the customer's data.
 *
 * Pure functions over plain data, deliberately separate from the React
 * renderer: a future server renderer that emits InDesign markup resolves the
 * exact same bindings with the exact same code.
 *
 * See templates/registry.js for the binding syntax.
 */

import { fieldForRole } from "../csv/schemas.js";

/*
 * Composite bindings — values assembled from several columns.
 *
 * Each receives the record AND the schema, so they resolve through semantic
 * roles rather than hardcoded column names and work across schemas.
 *
 * All of them return "" when they have nothing, which is what lets a field
 * collapse cleanly instead of rendering an empty box or a placeholder.
 */
const val = (record, schema, role) => {
  const field = fieldForRole(schema, role);
  return field ? String(record?.[field.key] ?? "").trim() : "";
};

/*
 * "Email: ava@example.org", or nothing at all.
 *
 * The label is attached here rather than being static text in the template so
 * that an empty optional field collapses completely. The production .indd
 * prints its labels unconditionally, so a household with no alternate phone
 * shows a bare "Alt Ph#:" there; in a proof that reads as a defect rather than
 * as an empty field, so the proof omits the whole line instead.
 */
const labelled = (label, value) => (value ? `${label}: ${value}` : "");

const COMPOSITES = {
  /*
   * The name to print.
   *
   * A schema that carries an explicit display column uses it — the customer
   * chose that form deliberately. The church directory has no such column by
   * design, so the name is composed from `last_name` and `first_name` in the
   * order the InDesign listing sets them: "Whitfield, Ava".
   *
   * Both halves are printed exactly as supplied. Nothing here invents a name,
   * substitutes one half for the other, or falls back to a fabricated value —
   * a record missing one half prints the half it has.
   */
  personName: (record, schema) => {
    if (!record) return "";
    const display = val(record, schema, "primaryText");
    if (display) return display;

    const last = val(record, schema, "lastName");
    const first = val(record, schema, "firstName");
    if (last && first) return `${last}, ${first}`;
    return last || first;
  },

  /* The address as supplied, on one line. The church directory template does
     not split city, state and postcode, so neither does this. */
  addressLine: (record, schema) => labelled("Address", val(record, schema, "addressLine")),

  altPhoneLine: (record, schema) => labelled("Alt Ph#", val(record, schema, "altPhone")),

  emailLine: (record, schema) => labelled("Email", val(record, schema, "email")),

  altEmailLine: (record, schema) => labelled("Alt Email", val(record, schema, "altEmail")),

  familyLine: (record, schema) => labelled("Family Members", val(record, schema, "familyMembers")),

  /* Kept for the street portion alone, where a schema separates it. */
  streetAddress: (record, schema) => val(record, schema, "addressLine"),

  /* "Marietta, GA 30060" — from whichever parts exist. Used by schemas that
     keep locality separate; the church directory does not. */
  cityStateLine: (record, schema) => {
    if (!record) return "";
    const city = val(record, schema, "city");
    const state = val(record, schema, "state");
    const postal = val(record, schema, "postalCode");
    const locality = [city, state].filter(Boolean).join(", ");
    return [locality, postal].filter(Boolean).join(" ");
  },

  /*
   * The full contact block, for layouts with one large text frame rather than
   * separate reserved lines.
   */
  contactBlock: (record, schema) => {
    if (!record) return "";
    return [
      COMPOSITES.streetAddress(record, schema),
      COMPOSITES.cityStateLine(record, schema),
      val(record, schema, "phone"),
      val(record, schema, "email"),
    ]
      .filter(Boolean)
      .join("\n");
  },
};

/**
 * @param {string} expression   The element's `field`.
 * @param {object} context
 * @param {Record<string,string>|null} context.record   Current record, if any.
 * @param {object} context.schema
 * @param {object} context.organization
 * @param {object} context.assetsByRecord   rowNumber → UploadedAsset
 * @param {import('../models.js').UploadedAsset|null} context.logo
 * @param {string} context.publicationLabel
 * @returns {{kind: 'text'|'image', value: string, asset?: object}}
 */
export function resolveBinding(expression, context) {
  const { record, schema, organization, logo, publicationLabel } = context;
  const raw = String(expression ?? "");

  if (!raw) return { kind: "text", value: "" };

  if (raw === "logo") {
    return { kind: "image", value: logo?.previewUrl ?? "", asset: logo ?? null };
  }

  if (raw === "record:image") {
    const asset = context.assetForRecord?.(record) ?? null;
    return { kind: "image", value: asset?.previewUrl ?? "", asset };
  }

  if (raw === "year") {
    return { kind: "text", value: String(new Date().getFullYear()) };
  }

  if (raw === "publicationLabel") {
    return { kind: "text", value: publicationLabel ?? "" };
  }

  if (raw.startsWith("static:")) {
    return { kind: "text", value: raw.slice(7) };
  }

  if (raw.startsWith("org:")) {
    return { kind: "text", value: String(organization?.[raw.slice(4)] ?? "") };
  }

  if (raw.startsWith("column:")) {
    return { kind: "text", value: String(record?.[raw.slice(7)] ?? "") };
  }

  if (raw.startsWith("role:")) {
    const role = raw.slice(5);
    const field = fieldForRole(schema, role);
    /* A schema may not carry every role a template asks for — a sponsor list
       has no `secondaryText`. That is not an error; the element simply renders
       its placeholder or nothing. */
    if (!field) return { kind: "text", value: "" };
    return { kind: "text", value: String(record?.[field.key] ?? "") };
  }

  if (Object.hasOwn(COMPOSITES, raw)) {
    return { kind: "text", value: COMPOSITES[raw](record, schema) };
  }

  return { kind: "text", value: "" };
}

/** True when a binding produces an image rather than text. */
export const isImageBinding = (expression) =>
  expression === "logo" || expression === "record:image";
