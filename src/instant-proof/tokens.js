import { FONT_FAMILY } from "../fonts.js";

/*
 * Instant Proof design tokens.
 *
 * ── Scope ──
 *
 * These are emitted as CSS custom properties on the Instant Proof root only —
 * never on :root — so the marketing site, the blog and the storefront keep the
 * typography and colour they already have. Nothing here leaks past this page.
 *
 * ── Typography ──
 *
 * One family, News Gothic Std, at four real weights. Display and body are the
 * same face deliberately: it is a news grotesque with a large x-height and open
 * apertures, and the hierarchy comes from size, weight and tracking rather than
 * from a second typeface arguing with the first.
 *
 * The stack itself lives in src/fonts.js, which is also where the licensing and
 * the loader are explained. Nothing here should ever name a family directly.
 */

export const PROOF_TOKENS = {
  /* Neutral chrome. The workspace is paper-coloured and everything structural
     is drawn in near-black or a hairline; the gold is reserved for accents. */
  border: "rgba(17, 20, 24, 0.12)",
  gold: "#aa7d48",
  goldDeep: "#8e6738",
  goldSoft: "rgba(170, 125, 72, 0.12)",
  navy: "#1b2a44",
  navyDeep: "#111c2e",
  ink: "#000000",
  inkSoft: "#1f2124",
  muted: "#55585d",
  paper: "#fdfcfa",
  surface: "#ffffff",
  line: "rgba(170, 125, 72, 0.55)",
  hairline: "rgba(0, 0, 0, 0.12)",
  danger: "#b3261e",

  /*
   * The InDesign scheme, taken from the Pressmark mark itself — the arrow's
   * gradient runs from this pink to this maroon, and they are the same two
   * colours Adobe uses for the application.
   *
   * Used for progress only. This is what the tool is doing (setting a document
   * in InDesign) rather than what Pressmark is, so it marks the steps and stops
   * there; the gold stays the brand accent everywhere else.
   */
  idPink: "#ef3b6a",
  idInk: "#460f21",
};

/* Page gutter. The reference sits at roughly this inset on a phone. */
export const PAGE_PAD = "22px";

/* Carousel thumbnail width, which sets how many are visible at a glance. At
   145px on a 390px screen a little under three are in view, which is what
   tells a visitor it scrolls. */
export const THUMB_W = 145;

export const PROOF_TOKENS_CSS = `
  .ip-root {
    --proof-gold: ${PROOF_TOKENS.gold};
    --proof-gold-deep: ${PROOF_TOKENS.goldDeep};
    --proof-gold-soft: ${PROOF_TOKENS.goldSoft};
    --proof-navy: ${PROOF_TOKENS.navy};
    --proof-navy-deep: ${PROOF_TOKENS.navyDeep};
    --proof-ink: ${PROOF_TOKENS.ink};
    --proof-ink-soft: ${PROOF_TOKENS.inkSoft};
    --proof-muted: ${PROOF_TOKENS.muted};
    --proof-paper: ${PROOF_TOKENS.paper};
    --proof-surface: ${PROOF_TOKENS.surface};
    --proof-line: ${PROOF_TOKENS.line};
    --proof-hairline: ${PROOF_TOKENS.hairline};
    --proof-danger: ${PROOF_TOKENS.danger};
    --proof-id-pink: ${PROOF_TOKENS.idPink};
    --proof-id-ink: ${PROOF_TOKENS.idInk};
    /* The pink at the weight a 1px ring can carry without shouting. */
    --proof-id-soft: rgba(239, 59, 106, 0.32);

    /* Spacing — a 4px scale, with generous vertical rhythm between sections. */
    --proof-space-1: 4px;
    --proof-space-2: 8px;
    --proof-space-3: 12px;
    --proof-space-4: 16px;
    --proof-space-5: 24px;
    --proof-space-6: 32px;
    --proof-space-7: 44px;
    --proof-pad: ${PAGE_PAD};

    /* Mostly square, with just enough radius to look intentional. */
    --proof-radius: 4px;
    --proof-radius-sm: 3px;
    /*
     * Cards are the exception. The workspace is a stack of panels a customer
     * works down, and at 4px they read as boxes ruled onto the page rather than
     * as separate things to act on. 12px is enough to separate them without the
     * bubbly look of a consumer app.
     */
    --proof-radius-lg: 12px;

    /*
     * A neutral hairline, distinct from --proof-line.
     *
     * --proof-line is gold: it is the editorial rule that separates sections and
     * it belongs to the brand. Card and control edges must not be — a workspace
     * outlined in gold on every panel is the opposite of restrained, and the one
     * accent colour stops meaning anything when everything wears it.
     */
    --proof-border: rgba(17, 20, 24, 0.12);
    --proof-border-strong: rgba(17, 20, 24, 0.28);
    --proof-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06);
    --proof-focus: #2563a8;

    /* The desktop sidebar. Wide enough for "Need a Custom Publication?" on one
       line at the nav's own size, which is what sets it. */
    --proof-sidebar-w: 272px;

    --proof-display: ${FONT_FAMILY};
    --proof-body: ${FONT_FAMILY};
    --proof-thumb-w: ${THUMB_W}px;

    /* The publication's own proportions, used by every cover thumbnail. */
    --proof-cover-ratio: 8.5 / 11;
  }
`;
