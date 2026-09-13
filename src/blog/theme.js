/*
 * Blog design tokens.
 *
 * Extends the marketing site's system rather than inventing one: the same
 * bronze accent, the same News Gothic Std setting, the same page gutter. The
 * only additions are the dark navy surfaces the site already uses for its nav
 * and hero, promoted to reusable tokens so editorial sections can sit on them.
 *
 * Deliberately does not import from App.jsx — that file exports nothing, and
 * refactoring a working production page to extract tokens is risk with no
 * upside here.
 */

import { FONT_FAMILY } from "../fonts.js";
import { ACCENT, BUTTON } from "../palette.js";

export const PALETTE = {
  base: "#ffffff",
  panel: "#ffffff",
  // The navy the nav and hero already use.
  ink: "#020814",
  inkSoft: "#051225",
  inkDeep: "#010611",
  /* InDesign maroon, from src/palette.js. `accentOnDark` is its pair for the
     navy hero, note and CTA blocks, where maroon would not be readable. */
  accent: ACCENT.ink,
  accentDeep: ACCENT.deep,
  accentOnDark: ACCENT.onDark,
  text: "#020814",
  textMuted: "#4b5563",
  textOnDark: "rgba(255,255,255,0.78)",
  textOnDarkMuted: "rgba(255,255,255,0.45)",
  border: ACCENT.line,
  borderOnDark: ACCENT.lineOnDark,
  hairline: "#e8e4dd",
  white: "#ffffff",
  paper: "#faf8f5",
};

/*
 * Both stacks are the same family now.
 *
 * They are kept as two names because ~200 call sites across the blog, the
 * storefront and the older proof components ask for one or the other, and the
 * distinction still says something about intent: FONT_STACK is display copy,
 * TITLE_FONT_STACK is interface copy. If the site ever pairs two faces again,
 * this is where they part company.
 */
export const FONT_STACK = FONT_FAMILY;
export const TITLE_FONT_STACK = FONT_FAMILY;
export const PAGE_X = "clamp(1.25rem, 5vw, 4rem)";
export const MAX_W = 1240;
export const PROSE_W = 720;

export const S = {
  page: {
    fontFamily: TITLE_FONT_STACK,
    background: PALETTE.base,
    color: PALETTE.text,
    margin: 0,
    padding: 0,
    overflowX: "hidden",
  },
  container: {
    width: "100%",
    maxWidth: MAX_W,
    margin: "0 auto",
    padding: `0 ${PAGE_X}`,
  },
  eyebrow: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: PALETTE.accent,
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  eyebrowLine: {
    width: 28,
    height: 1,
    background: PALETTE.accent,
    display: "inline-block",
    flexShrink: 0,
  },
  h1: {
    fontFamily: FONT_STACK,
    fontSize: "clamp(2.4rem, 6vw, 4rem)",
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: "0.01em",
    margin: 0,
  },
  h2: {
    fontFamily: FONT_STACK,
    fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)",
    fontWeight: 700,
    lineHeight: 1.15,
    margin: 0,
  },
  lead: {
    fontSize: "clamp(1rem, 2vw, 1.15rem)",
    lineHeight: 1.8,
    color: PALETTE.textMuted,
    margin: 0,
  },
  btnPrimary: {
    display: "inline-block",
    fontFamily: TITLE_FONT_STACK,
    fontSize: BUTTON.fontSize,
    fontWeight: 400,
    lineHeight: BUTTON.height,
    textDecoration: "none",
    color: BUTTON.text,
    background: BUTTON.background,
    padding: `0 ${BUTTON.paddingX}`,
    border: `1px solid ${BUTTON.border}`,
    borderRadius: BUTTON.radius,
    cursor: "pointer",
    transition: "border-color 0.1s, box-shadow 0.1s, color 0.1s",
  },
  btnGhost: {
    display: "inline-block",
    /* The same key as btnPrimary. It used to be a white outline for dark
       grounds; the grey key reads on navy and on paper alike. */
    fontFamily: TITLE_FONT_STACK,
    fontSize: BUTTON.fontSize,
    fontWeight: 400,
    lineHeight: BUTTON.height,
    textDecoration: "none",
    color: BUTTON.text,
    background: BUTTON.background,
    padding: `0 ${BUTTON.paddingX}`,
    border: `1px solid ${BUTTON.border}`,
    borderRadius: BUTTON.radius,
    cursor: "pointer",
    transition: "border-color 0.1s, box-shadow 0.1s, color 0.1s",
  },
};

/* Shared CSS for every blog entry point. Mirrors the marketing site's font
   import and hover conventions so nothing looks bolted on. */
export const GLOBAL_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${PALETTE.base}; overflow-x: hidden; }
  a { color: ${PALETTE.accent}; }
  /* The pink, not the maroon: a focus ring has to show on the navy header as
     well as on the white article, and the pink clears both. */
  button:focus-visible, a:focus-visible {
    outline: 2px solid ${PALETTE.accentOnDark};
    outline-offset: 3px;
  }
  .pm-btn-primary:hover,
  .pm-btn-ghost:hover {
    border-color: ${BUTTON.borderHover} !important;
    box-shadow: ${BUTTON.shadowHover};
    color: ${BUTTON.textHover} !important;
  }
  @media (pointer: coarse) {
    .pm-btn-primary, .pm-btn-ghost { line-height: ${BUTTON.touchHeight} !important; }
  }
  .pm-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .pm-card:hover { transform: translateY(-4px); box-shadow: 0 18px 48px rgba(2,8,20,0.13); }
  .pm-card:hover .pm-card-title { color: ${PALETTE.accent}; }
  .pm-chip:hover { border-color: ${PALETTE.accent} !important; color: ${PALETTE.accent} !important; }
  .pm-prose a { color: ${PALETTE.accent}; text-underline-offset: 3px; }
  .pm-toc a:hover { color: ${PALETTE.accent}; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .pm-card:hover { transform: none; }
  }
`;

/* Heading slugs — shared so the table of contents and the headings it links
   to can never disagree. */
export const headingId = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* Responsive rules for the grid-based pieces. Mirrors the marketing site's
   breakpoints: 3 up on desktop, 2 on tablet, 1 on mobile. */
export const BLOG_RESPONSIVE_CSS = `
  @media (max-width: 1024px) {
    .blog-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  }
  @media (max-width: 900px) {
    .blog-featured { grid-template-columns: minmax(0, 1fr) !important; }
    .article-layout { grid-template-columns: minmax(0, 1fr) !important; }
    .article-toc { position: static !important; }
  }
  @media (max-width: 860px) {
    .blog-desktop-nav { display: none !important; }
    .blog-hamburger { display: flex !important; }
  }
  @media (max-width: 640px) {
    .blog-grid { grid-template-columns: minmax(0, 1fr) !important; }
  }
  .blog-nav-link:hover { color: ${PALETTE.accentOnDark} !important; }
`;
