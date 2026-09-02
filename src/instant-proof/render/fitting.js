/*
 * Text and image fitting rules.
 *
 * A publication proof is worthless if one long name pushes a grid apart. Every
 * text element declares how it behaves when its content exceeds its box, and
 * every image declares how it fills its frame. Nothing is left to chance,
 * because real customer data reliably contains a hyphenated surname three times
 * longer than anything in a design mockup.
 *
 *   truncate  one line, ellipsis at the edge
 *   clamp     up to maxLines, ellipsis on the last
 *   shrink    reduce the type size in steps until it fits the declared lines
 *
 * Images always preserve aspect ratio. `cover` crops to fill (portraits, where
 * a consistent crop matters more than seeing the whole frame); `contain` fits
 * inside without cropping (logos, where cropping would be vandalism).
 */

/**
 * Estimate how many lines a string needs in a box of a given width.
 *
 * A measurement-free approximation: average glyph advance for the family's
 * weight class, times character count, over the available width. It only needs
 * to be good enough to decide *whether* to shrink and by how much — the CSS
 * line clamp below is what actually guarantees the box is never overflowed.
 *
 * @param {string} text
 * @param {number} boxWidthIn   Box width in inches.
 * @param {number} sizePt       Type size in points.
 * @param {number} [advance]    Average advance as a fraction of the em.
 */
export function estimateLines(text, boxWidthIn, sizePt, advance = 0.5) {
  const content = String(text ?? "");
  if (!content) return 0;
  const boxWidthPt = boxWidthIn * 72;
  const charsPerLine = Math.max(Math.floor(boxWidthPt / (sizePt * advance)), 1);

  /* Count per hard line so an address block with newlines is measured as the
     several short lines it actually is, not as one long run. */
  return content
    .split("\n")
    .reduce((total, line) => total + Math.max(Math.ceil(line.length / charsPerLine), 1), 0);
}

/* Steps the shrink strategy walks, as fractions of the declared size. */
const SHRINK_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.62];

/*
 * An absolute floor, in points. Shrinking is a way to keep a long name whole,
 * not a licence to make it unreadable — past this size the honest answer is to
 * clamp and ellipsize, which the CSS below always does regardless. The floor is
 * absolute rather than proportional so a role that is already small (a 10pt
 * address) cannot be shrunk into invisibility by the same 0.62 multiplier that
 * is reasonable for a 44pt headline.
 */
const MIN_SIZE_PT = 7;

/**
 * Choose a type size for an element whose textFit is 'shrink'.
 *
 * @returns {number} The size in points to actually set.
 */
export function fitTypeSize(text, boxWidthIn, boxHeightIn, sizePt, maxLines, lineHeight = 1.15) {
  const floor = Math.min(sizePt, MIN_SIZE_PT);

  for (const step of SHRINK_STEPS) {
    const candidate = Math.max(sizePt * step, floor);
    const lines = estimateLines(text, boxWidthIn, candidate);
    const linesFitBox = (lines * candidate * lineHeight) / 72 <= boxHeightIn;
    if (lines <= maxLines && linesFitBox) return candidate;
    if (candidate === floor) break;
  }

  /* Still too long even at the floor. The line clamp takes over from here and
     ends it with an ellipsis — text never escapes its box. */
  return floor;
}

/**
 * The CSS an element's textFit implies.
 *
 * `-webkit-line-clamp` is the only cross-browser way to ellipsize multiple
 * lines; it is supported everywhere this site targets and degrades to a plain
 * overflow clip if it ever is not — which still protects the layout.
 */
export function textFitStyle(textFit, maxLines = 1) {
  if (textFit === "truncate") {
    return { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  }
  if (textFit === "clamp" || textFit === "shrink") {
    return {
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: String(Math.max(maxLines, 1)),
      overflow: "hidden",
      /* A single unbroken 40-character surname would otherwise escape the box
         sideways; clamping only limits height. */
      overflowWrap: "anywhere",
    };
  }
  return { overflow: "hidden", overflowWrap: "anywhere" };
}

/** Image fill behavior. Never `fill` — a stretched portrait is unusable. */
export function imageFitStyle(fitMode) {
  return {
    objectFit: fitMode === "contain" ? "contain" : "cover",
    /* Faces sit in the upper half of a portrait. Cropping from the top keeps
       them in frame when the aspect ratio does not match the cell. */
    objectPosition: fitMode === "contain" ? "center" : "center 28%",
  };
}
