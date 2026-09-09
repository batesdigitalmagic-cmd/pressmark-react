/*
 * Design templates — the third of the three Phase 2 concepts.
 *
 *   Publication configuration  →  what the customer is making
 *   Content schema             →  which columns and assets that content needs
 *   Design template            →  how it is laid out on the page              ← this file
 *
 * A template is pure data. It knows nothing about React, nothing about the
 * wizard, and nothing about where its content came from. TemplateRenderer.jsx
 * turns a manifest plus a record set into DOM; a future server renderer will
 * turn the same manifest plus the same records into an InDesign document.
 *
 * ── Coordinates ──
 *
 * Every position and size is in INCHES, measured from the top-left of the page,
 * exactly as InDesign's geometry panel reports them. That is deliberate: a
 * designer builds the layout in InDesign, reads X/Y/W/H off the panel, and
 * types the same numbers here. No unit conversion, no mental arithmetic, no
 * drift between the browser proof and the production document.
 *
 * The renderer converts inches to percentages of the page box, so the preview
 * scales to any width without the internal proportions changing.
 *
 * ── Binding syntax ──
 *
 * An element's `field` says where its content comes from:
 *
 *   role:primaryText        the schema field carrying that semantic role
 *   column:display_name     a specific canonical column
 *   org:organizationName    a field from OrganizationInformation
 *   record:image            the photograph matched to the current record
 *   logo                    the customer's uploaded logo
 *   year                    the current year
 *   static:Some Text        a literal
 *
 * Binding by ROLE rather than by column name is what lets one template serve
 * several schemas — a listing cell asks for `role:primaryText` and gets
 * display_name from a directory or a yearbook roster without knowing which.
 *
 * ── Colors and fonts ──
 *
 * Elements name a color ROLE (primary, secondary, paper, ink, onPrimary), never
 * a hex value. The renderer resolves roles against the customer's chosen brand
 * colors, which is what makes the proof look like their publication.
 * Likewise `fontRole` resolves against the template's own `fontRoles` table.
 */

/**
 * @typedef {object} TemplateElement
 * @property {'text'|'image'|'rule'|'block'|'repeater'|'stack'} type
 * @property {string} [field]        Binding expression; see above.
 * @property {number} x              Inches from the left edge.
 * @property {number} y              Inches from the top edge.
 * @property {number} width          Inches.
 * @property {number} height         Inches.
 * @property {string} [fontRole]     Key into the template's fontRoles.
 * @property {string} [color]        Color role.
 * @property {string} [background]   Color role for a filled block.
 * @property {'left'|'center'|'right'} [alignment]
 * @property {'cover'|'contain'} [fitMode]        Images.
 * @property {'truncate'|'clamp'|'shrink'} [textFit]  Text overflow behavior.
 * @property {number} [maxLines]     With textFit 'clamp'.
 * @property {number} [radius]       Corner radius in inches.
 * @property {number} [opacity]
 * @property {object} [repeat]       Repeater geometry: {columns, rows, gapX, gapY}.
 * @property {TemplateElement[]} [cell]  Repeater cell contents, positioned relative to the cell.
 * @property {object[]} [children]  Stack children, laid out in flow; empty ones collapse.
 * @property {number} [gap]         Stack: inches between consecutive children.
 * @property {number} [groupGap]    Stack: inches when crossing a `group` boundary.
 * @property {string} [placeholder]  Shown when the binding resolves to nothing.
 */

/**
 * @typedef {object} TemplatePage
 * @property {string} id
 * @property {string} pageType          cover | listing-spread | profile-spread | portrait-spread | feature-spread
 * @property {string} label
 * @property {string} caption           Shown under the page in the results view.
 * @property {'single'|'spread'} form
 * @property {string} [background]      Public path to the non-variable artwork.
 * @property {string} [backgroundColor] Color role painted under the artwork.
 * @property {boolean} [footerOnDark]   Force light footer type when the artwork
 *                                      behind the credit is darker than the page.
 * @property {TemplateElement[]} elements
 */

/**
 * @typedef {object} DesignTemplate
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} publicationTypes   PUBLICATION_CONFIGS ids this suits.
 * @property {string} styleCategory        A STYLE_DIRECTIONS id — filter metadata, not the design itself.
 * @property {'csv'|'photos'} inputMode    Content workflow and validation capability.
 * @property {string} thumbnail
 * @property {string[]} schemas            CONTENT_SCHEMAS ids this template can render.
 * @property {{width:number, height:number, unit:'in'}} pageSize
 * @property {Record<string,object>} fontRoles
 * @property {Record<string,string>} defaultColors  Color role → hex fallback.
 * @property {{text:string, opacity?:number}} footerMark  Credit line in the page footer.
 * @property {number} maxRecordsPerPage
 * @property {'continue'|'truncate'} overflow
 * @property {TemplatePage[]} pages
 */

import { directoryClassic } from "./directory-classic.js";
import { yearbookModern } from "./yearbook-modern.js";
import { photoGallery } from "./photo-gallery.js";

/** @type {DesignTemplate[]} */
export const DESIGN_TEMPLATES = [photoGallery, directoryClassic, yearbookModern];

/*
 * Designs that carry no per-record text. These are the ones to offer first when
 * a visitor has photographs and nothing else — a structured layout would print
 * empty name and title bands under every picture.
 */
export const PHOTO_LED_TEMPLATE_IDS = ["photo-gallery"];

export const isPhotoLed = (templateId) => PHOTO_LED_TEMPLATE_IDS.includes(templateId);

/** @param {string} id @returns {DesignTemplate|undefined} */
export const templateFor = (id) => DESIGN_TEMPLATES.find((template) => template.id === id);

/**
 * Templates suitable for a publication type. Falls back to every template when
 * a type has no dedicated design yet, so a new publication type is never left
 * with an empty selector.
 */
export function templatesForPublication(publicationTypeId) {
  const matches = DESIGN_TEMPLATES.filter((template) =>
    template.publicationTypes.includes(publicationTypeId)
  );
  return matches.length > 0 ? matches : DESIGN_TEMPLATES;
}

/**
 * The design to preselect, so a visitor never has to make a choice before they
 * can get anywhere.
 *
 * Quick Photo Proof leads with the photograph-led design; the spreadsheet path
 * leads with the first structured design that suits the publication type.
 */
export function defaultTemplateFor(publicationTypeId, { photoLed = false } = {}) {
  const available = templatesForPublication(publicationTypeId);
  if (photoLed) {
    const gallery = available.find((template) => isPhotoLed(template.id));
    if (gallery) return gallery.id;
  }
  const structured = available.find((template) => !isPhotoLed(template.id));
  return (structured ?? available[0])?.id ?? "";
}

/** Distinct style categories across a template list, for the filter chips. */
export const styleCategoriesIn = (templates) => [
  ...new Set(templates.map((template) => template.styleCategory)),
];

/** Page types a template can produce, in page order. */
export const pageTypesOf = (template) => [
  ...new Set((template?.pages ?? []).map((page) => page.pageType)),
];

/**
 * How many records a template's repeaters consume across all its pages.
 * Used to decide how much of the customer's data the sample can show, and
 * therefore how many records to report as omitted.
 *
 * A spread's repeater is authored across the full 17in width — its `columns`
 * already covers both pages — so there is no page multiplier here.
 */
export function recordCapacityOf(template) {
  let capacity = 0;
  for (const page of template?.pages ?? []) {
    for (const element of page.elements ?? []) {
      if (element.type !== "repeater") continue;
      const { columns = 1, rows = 1 } = element.repeat ?? {};
      capacity += columns * rows;
    }
  }
  return capacity;
}

/** Records the largest single repeater on a template can show. */
export function largestGridOf(template) {
  let largest = 0;
  for (const page of template?.pages ?? []) {
    for (const element of page.elements ?? []) {
      if (element.type !== "repeater") continue;
      const { columns = 1, rows = 1 } = element.repeat ?? {};
      largest = Math.max(largest, columns * rows);
    }
  }
  return largest;
}

/*
 * The build method a template implies.
 *
 * `ProofProject.mode` decides where records come from — recordsFor() reads
 * photographs in `photo` mode and the parsed spreadsheet in `data` mode. The
 * mode selector is hidden for CSV-driven designs, so a visitor who chooses
 * Directory Classic never sets it and it keeps its `photo` default; the
 * directory then renders from photographs while the customer's spreadsheet sits
 * unused. Deriving it from the design closes that gap at the source.
 *
 * Returns the mode as one of ProofProject's two values without importing
 * models.js, which would make this module depend on the shape it describes.
 */
export function modeForTemplate(templateId, fallback = "photo") {
  const template = templateFor(templateId);
  if (!template) return fallback;
  return template.inputMode === "csv" ? "data" : "photo";
}

/*
 * The caption printed under a page in the results view.
 *
 * A page's `caption` describes the layout and is always true. `countCaption`
 * additionally states how much of the customer's content landed on the page,
 * and is used only when something actually did.
 *
 * Two fields rather than one interpolated string because the count is not
 * always available: the listing spread was captioned "Twelve of your records
 * placed into the template's profile grid" whatever the spreadsheet held, so a
 * three-family directory was told twelve of its records were on a page showing
 * three. The number is the customer's own data being described back to them —
 * it has to be the real one or not appear at all.
 */
export function captionFor(page, count = 0) {
  if (!page) return "";
  if (count > 0 && page.countCaption) {
    return page.countCaption.replace("{count}", String(count));
  }
  return page.caption ?? "";
}
