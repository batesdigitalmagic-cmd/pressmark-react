/*
 * Blog design tokens.
 *
 * Extends the marketing site's system rather than inventing one: the same
 * bronze accent, the same Cormorant/Inter pairing, the same page gutter. The
 * only additions are the dark navy surfaces the site already uses for its nav
 * and hero, promoted to reusable tokens so editorial sections can sit on them.
 *
 * Deliberately does not import from App.jsx — that file exports nothing, and
 * refactoring a working production page to extract tokens is risk with no
 * upside here.
 */

export const PALETTE = {
  base: "#ffffff",
  panel: "#ffffff",
  // The navy the nav and hero already use.
  ink: "#020814",
  inkSoft: "#051225",
  inkDeep: "#010611",
  accent: "#aa7d48",
  accentDeep: "#96693a",
  text: "#020814",
  textMuted: "#4b5563",
  textOnDark: "rgba(255,255,255,0.78)",
  textOnDarkMuted: "rgba(255,255,255,0.45)",
  border: "rgba(170,125,72,0.3)",
  borderOnDark: "rgba(170,125,72,0.35)",
  hairline: "#e8e4dd",
  white: "#ffffff",
  paper: "#faf8f5",
};

export const FONT_STACK = "'Cormorant Garamond', Georgia, serif";
export const TITLE_FONT_STACK = "Inter, 'Helvetica Neue', Arial, sans-serif";
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
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: "0.01em",
    margin: 0,
  },
  h2: {
    fontFamily: FONT_STACK,
    fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)",
    fontWeight: 900,
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
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    textDecoration: "none",
    color: "#000000",
    background: PALETTE.accent,
    padding: "0.95rem 1.9rem",
    border: "none",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  btnGhost: {
    display: "inline-block",
    fontFamily: TITLE_FONT_STACK,
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    textDecoration: "none",
    color: PALETTE.white,
    background: "transparent",
    border: `1px solid rgba(255,255,255,0.35)`,
    padding: "0.95rem 1.9rem",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};

/* Shared CSS for every blog entry point. Mirrors the marketing site's font
   import and hover conventions so nothing looks bolted on. */
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;0,900;1,600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: ${PALETTE.base}; overflow-x: hidden; }
  a { color: ${PALETTE.accent}; }
  button:focus-visible, a:focus-visible {
    outline: 2px solid ${PALETTE.accent};
    outline-offset: 3px;
  }
  .pm-btn-primary:hover { background: ${PALETTE.accentDeep} !important; }
  .pm-btn-ghost:hover { border-color: ${PALETTE.accent} !important; color: ${PALETTE.accent} !important; }
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
  .blog-nav-link:hover { color: #aa7d48 !important; }
`;
