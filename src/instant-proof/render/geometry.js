/*
 * The one coordinate system.
 *
 * ── The rule ──
 *
 * Every element's x / y / width / height is in INCHES, measured from the
 * top-left of the BOX THAT CONTAINS IT.
 *
 *   • A page-level element is measured from the top-left of the page (or, on a
 *     spread, of the full two-page sheet — 17in wide, not 8.5in).
 *   • An element inside a repeater cell is measured from the top-left of THAT
 *     CELL, not the page.
 *
 * There is no third case. A component that draws an element takes a `box` and
 * uses it for every dimension — width, height and type size alike.
 *
 * ── Why this module exists ──
 *
 * It replaces a `template` + `pageWidthIn` prop pair that had to be
 * substituted with cell dimensions when descending into a repeater. That is
 * exactly what went wrong: the cell width was passed under the name
 * `pageWidthIn` while the receiving component destructured `cellWidthIn`, so
 * every horizontal value inside a cell evaluated to NaN. Browsers silently drop
 * invalid declarations, so the cells fell back to `left:auto; width:auto;
 * font-size:inherit` — names landed on titles, addresses inherited the page's
 * font size, and lines broke wherever they liked.
 *
 * Passing one `box` object removes the possibility: there is no second
 * dimension source to disagree with, and a missing box fails loudly rather than
 * producing NaN.
 *
 * ── Type size ──
 *
 * Sizes are in POINTS, because that is what InDesign reports and what the
 * template manifests declare. They are emitted in `cqw` — a percentage of the
 * containing query container's width.
 *
 * That makes the container declaration load-bearing: `cqw` resolves against the
 * nearest ancestor with `container-type: inline-size`. A box whose type is
 * scaled by `box.widthIn` MUST itself be a query container, or the type scales
 * against some ancestor's width instead. `containerStyle()` below is the only
 * way a box is opened, so the two cannot drift apart.
 */

const PT_PER_IN = 72;

/**
 * @typedef {object} Box
 * @property {number} widthIn
 * @property {number} heightIn
 */

/** @returns {Box} */
export const box = (widthIn, heightIn) => ({ widthIn, heightIn });

/**
 * A box's own CSS. Establishes the container-query context that `pt()` inside
 * it depends on.
 */
export const containerStyle = () => ({
  position: "relative",
  width: "100%",
  height: "100%",
  /* Load-bearing: every `cqw` produced by pt() below resolves against this. */
  containerType: "inline-size",
});

/**
 * Absolute position and size for an element, as percentages of its box.
 *
 * Percentages rather than pixels is what makes the preview scale: the same
 * element yields the same percentages at any rendered width, so the internal
 * proportions of a page never change between a phone and a desktop.
 *
 * @param {{x:number,y:number,width:number,height:number}} element
 * @param {Box} within
 */
export function frame(element, within) {
  assertBox(within, element);
  return {
    position: "absolute",
    left: `${(element.x / within.widthIn) * 100}%`,
    top: `${(element.y / within.heightIn) * 100}%`,
    width: `${(element.width / within.widthIn) * 100}%`,
    height: `${(element.height / within.heightIn) * 100}%`,
  };
}

/**
 * A type size in points, expressed against a box.
 *
 * `within.widthIn` inches span 100cqw, so one inch is `100 / widthIn` cqw and a
 * point is that over 72.
 *
 * @param {number} sizePt
 * @param {Box} within
 */
export function pt(sizePt, within) {
  assertBox(within);
  return `${((sizePt / PT_PER_IN) * 100) / within.widthIn}cqw`;
}

/** A length in inches expressed as a percentage of a box's width. */
export function inchesAcross(inches, within) {
  assertBox(within);
  return `${(inches / within.widthIn) * 100}%`;
}

/**
 * The cell box of a repeater, derived from its geometry.
 * Single source of truth: the renderer, the planner and the tests all size a
 * cell the same way.
 */
export function cellBox(element) {
  const { columns = 1, rows = 1, gapX = 0, gapY = 0 } = element.repeat ?? {};
  return box(
    (element.width - gapX * (columns - 1)) / columns,
    (element.height - gapY * (rows - 1)) / rows
  );
}

/** The box a page occupies. A spread is two pages wide. */
export function pageBox(template, page) {
  return box(
    page.form === "spread" ? template.pageSize.width * 2 : template.pageSize.width,
    template.pageSize.height
  );
}

/*
 * A missing or malformed box previously produced NaN percentages, which
 * browsers discard without complaint — the failure was invisible until someone
 * looked at a rendered page. Failing here instead makes it a five-second fix.
 */
function assertBox(within, element) {
  if (
    !within ||
    !Number.isFinite(within.widthIn) ||
    !Number.isFinite(within.heightIn) ||
    within.widthIn <= 0 ||
    within.heightIn <= 0
  ) {
    const where = element?.field ? ` (element "${element.field}")` : "";
    throw new Error(
      `TemplateRenderer: invalid box${where}. Expected {widthIn, heightIn} in inches, received ${JSON.stringify(within)}.`
    );
  }
}
