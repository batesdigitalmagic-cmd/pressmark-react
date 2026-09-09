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
 * The reference uses a heavy hand-drawn display face. The repository has no
 * local font files and adding a CDN or an unlicensed font is out of bounds, so
 * the display face is the system sans at weight 900 with tightened tracking —
 * the closest available approximation. Inter leads the stack so it is used
 * wherever a visitor happens to have it; otherwise Helvetica Neue or Arial
 * carries it, which is what the reference's body copy looks like anyway.
 *
 * Swapping in a real display face later is a one-line change to --proof-display
 * plus an @font-face rule; nothing else needs to know.
 */

export const PROOF_TOKENS = {
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

    --proof-display: Inter, 'Helvetica Neue', Arial, sans-serif;
    --proof-body: Inter, 'Helvetica Neue', Arial, sans-serif;
    --proof-thumb-w: ${THUMB_W}px;

    /* The publication's own proportions, used by every cover thumbnail. */
    --proof-cover-ratio: 8.5 / 11;
  }
`;
