/*
 * Customer brand colours: the one definition of what a colour is.
 *
 * ── Why this file is under src/ when the server uses it too ──
 *
 * The browser validates before submitting, the API validates before queueing,
 * and the worker converts before handing values to InDesign. Three copies of a
 * hex regex is three chances to disagree about what "valid" means — and the one
 * that matters is the API's, because that is the value that reaches the render.
 *
 * eslint.config.js forbids src/ importing lib/ or api/ (those carry secrets).
 * The reverse is allowed and already done — scripts/render-jobs.test.mjs reads
 * src/instant-proof/templates/registry.js. This module is pure arithmetic with
 * no browser or Node API in it, so api/ and worker/ import it directly.
 *
 * ── The CMYK conversion ──
 *
 * This is the naive device conversion, not a colour-managed one. It has no ICC
 * profile and no rendering intent, so the printed result depends on the
 * document's own CMYK working space. That is the right trade here: the customer
 * is choosing a colour on a screen, and a page that reproduces their intent
 * closely is worth more than a colour-managed pipeline nobody asked for.
 *
 * It also means the round trip is lossy in one direction. A hex converted to
 * CMYK and back is itself, but a CMYK swatch converted to hex and back is only
 * close: hexToCmyk always produces the maximum-black form, so PM_LightTint's
 * 100/90/10/20 returns as 100/89/0/28. That is precisely why an untouched colour
 * is never submitted — see changedColors below.
 */

/**
 * The six swatches a customer can change, in the order they are offered.
 *
 * `swatch` is the name in church-directory-classic.indd. `cmyk` is what that
 * swatch actually contains today, read out of the .idml — so the value the page
 * shows as its default is the value the template really has, not a guess that
 * happens to look similar.
 *
 * Adding a seventh colour means adding a row here and a swatch to the template.
 * Nothing else in the pipeline names them: the API validates against this list,
 * the worker builds the handoff from it, and the ExtendScript applies whatever
 * the handoff names.
 */
export const BRAND_COLORS = [
  {
    key: "primaryColor",
    swatch: "PM_Primary",
    label: "Primary",
    hint: "Headings, mastheads and section rules.",
    cmyk: { c: 0, m: 0, y: 0, k: 100 },
  },
  {
    key: "secondaryColor",
    swatch: "PM_Secondary",
    label: "Secondary",
    hint: "The supporting colour beside the primary.",
    cmyk: { c: 0, m: 70, y: 100, k: 0 },
  },
  {
    key: "accentColor",
    swatch: "PM_Accent",
    label: "Accent",
    hint: "Dividers, borders and small marks.",
    cmyk: { c: 18, m: 42, y: 100, k: 0 },
  },
  {
    key: "textColor",
    swatch: "PM_Text",
    label: "Text",
    hint: "Body copy. Black here prints as K only.",
    cmyk: { c: 0, m: 0, y: 0, k: 100 },
  },
  {
    key: "backgroundColor",
    swatch: "PM_Background",
    label: "Background",
    hint: "The page ground behind everything.",
    cmyk: { c: 0, m: 0, y: 0, k: 0 },
  },
  {
    key: "lightTint",
    swatch: "PM_LightTint",
    label: "Light tint",
    hint: "Banding and shaded panels.",
    cmyk: { c: 100, m: 90, y: 10, k: 20 },
  },
];

/** The field names a job may carry. */
export const BRAND_COLOR_KEYS = BRAND_COLORS.map((color) => color.key);

/** key -> InDesign swatch name. The only place the two vocabularies meet. */
export const SWATCH_FOR = Object.fromEntries(
  BRAND_COLORS.map((color) => [color.key, color.swatch])
);

/**
 * Normalize a colour to `#RRGGBB`, or return "" if it is not one.
 *
 * Six digits only. Three-digit shorthand is rejected rather than expanded: both
 * sources we accept from — the native colour input and the typed field —
 * produce six, so a three-digit value means something else went wrong and
 * guessing at it would hide that.
 *
 * @param {unknown} value
 * @returns {string} `#RRGGBB` uppercase, or "" when invalid.
 */
export function normalizeHex(value) {
  const text = String(value ?? "").trim();
  const digits = text.startsWith("#") ? text.slice(1) : text;
  if (!/^[0-9a-fA-F]{6}$/.test(digits)) return "";
  return `#${digits.toUpperCase()}`;
}

/** @returns {boolean} true when `value` is a six-digit hex colour. */
export const isValidHex = (value) => normalizeHex(value) !== "";

/**
 * @param {string} hex `#RRGGBB`, validated by the caller.
 * @returns {{r: number, g: number, b: number}} 0–255 each.
 */
export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error("Not a six-digit hex colour.");
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

/**
 * RGB to CMYK, each component a whole percentage 0–100.
 *
 * Whole numbers because that is the unit InDesign's swatch dialog uses and the
 * unit an operator can check by eye against the panel. Pure black maps to
 * K=100 with no CMY under it — a rich black would be wrong for body text and
 * hairline rules, which is what these swatches are most likely to be used on.
 */
export function rgbToCmyk({ r, g, b }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const k = 1 - Math.max(red, green, blue);
  /* Pure black: dividing by (1 - k) would be a division by zero. */
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const round = (value) => Math.round(value * 100);
  return {
    c: round((1 - red - k) / (1 - k)),
    m: round((1 - green - k) / (1 - k)),
    y: round((1 - blue - k) / (1 - k)),
    k: round(k),
  };
}

/** @param {string} hex `#RRGGBB` @returns {{c,m,y,k}} whole percentages. */
export const hexToCmyk = (hex) => rgbToCmyk(hexToRgb(hex));

/**
 * CMYK to `#RRGGBB`, so a swatch read out of the template can be shown in a
 * colour picker. The same naive model as the conversion above, inverted.
 */
export function cmykToHex({ c, m, y, k }) {
  const channel = (ink) => Math.round(255 * (1 - ink / 100) * (1 - k / 100));
  const pair = (value) => value.toString(16).padStart(2, "0").toUpperCase();
  return `#${pair(channel(c))}${pair(channel(m))}${pair(channel(y))}`;
}

/** What the page shows before the customer touches anything: the template's
    own swatches, as hex. */
export const DEFAULT_COLORS = Object.freeze(
  Object.fromEntries(BRAND_COLORS.map((color) => [color.key, cmykToHex(color.cmyk)]))
);

/**
 * The handoff encoding InDesign reads: `c,m,y,k` as whole numbers.
 *
 * The handoff file is `key=value` lines with no escaping, so the value must be
 * a single line carrying no "=" — four integers and three commas is the whole
 * format, and it parses in ES3 with a split.
 */
export const cmykToHandoff = ({ c, m, y, k }) => `${c},${m},${y},${k}`;

/**
 * The colours a job should carry: the ones that differ from the template.
 *
 * ── Why unchanged colours are omitted ──
 *
 * Sending all six every time would repaint every swatch on every render,
 * including the five the customer never looked at — and because the CMYK round
 * trip is lossy in that direction, PM_LightTint would come back as 100/89/0/28
 * rather than the 100/90/10/20 the designer set. Omitting them leaves an
 * untouched swatch exactly as the template has it, so a customer who changes
 * one colour changes one colour.
 *
 * @param {Record<string, string>} chosen  every colour the page is holding.
 * @param {string[]} keys  the swatches this design exposes.
 * @returns {Record<string, string>} key -> `#RRGGBB`, only for real changes.
 */
export function changedColors(chosen = {}, keys = BRAND_COLOR_KEYS, defaults = DEFAULT_COLORS) {
  const changed = {};
  /* Scoped to the design's own swatches. A colour edited under one design must
     not follow the customer to another that does not use it — they would be
     paying for a change they cannot see. */
  for (const key of keys) {
    const hex = normalizeHex(chosen[key]);
    if (hex && hex !== normalizeHex(defaults[key])) changed[key] = hex;
  }
  return changed;
}

/**
 * Validate whatever subset of the six a request carries.
 *
 * Any subset is legitimate — none at all is the commonest case — but every
 * value present must be a real colour, because it ends up in a key=value file
 * an ExtendScript parses.
 *
 * @returns {{ok: true, colors: Record<string, string>}
 *          |{ok: false, error: string}}
 */
export function validateBrandColors(input = {}) {
  const colors = {};
  for (const key of BRAND_COLOR_KEYS) {
    const raw = input[key];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    const hex = normalizeHex(raw);
    if (!hex) {
      return { ok: false, error: `${key} must be a six-digit hex colour such as #7A1F35.` };
    }
    colors[key] = hex;
  }
  return { ok: true, colors };
}
