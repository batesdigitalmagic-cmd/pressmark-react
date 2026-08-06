/*
 * Storefront design tokens, mirroring the marketing site in App.jsx.
 *
 * Kept as its own module so the storefront pages don't import App.jsx (which
 * would pull the entire marketing site into their bundles) and so App.jsx
 * needs no edits to support them.
 */

export const PALETTE = {
  base: "#ffffff",
  panel: "#ffffff",
  accent: "#aa7d48",
  text: "#020814",
  textMuted: "#4b5563",
  border: "rgba(170,125,72,0.3)",
  danger: "#b3261e",
  black: "#000000",
  white: "#ffffff",
  keyBg: "#faf8f5",
};

export const FONT_STACK = "'Cormorant Garamond', Georgia, serif";
export const TITLE_FONT_STACK = "Inter, 'Helvetica Neue', Arial, sans-serif";
/* The marketing site has no monospace face. License keys need one — they are
   read aloud, retyped, and compared character by character. */
export const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const PAGE_X = "clamp(1.25rem, 5vw, 4rem)";

export const S = {
  shell: {
    minHeight: "100svh",
    background: PALETTE.base,
    color: PALETTE.text,
    fontFamily: TITLE_FONT_STACK,
    padding: `clamp(2.5rem, 8vw, 5rem) ${PAGE_X} clamp(4rem, 10vw, 6rem)`,
    display: "flex",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 560,
  },
  eyebrow: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: PALETTE.accent,
    margin: "0 0 0.9rem",
  },
  h1: {
    fontFamily: FONT_STACK,
    fontSize: "clamp(2.1rem, 6vw, 3rem)",
    fontWeight: 900,
    lineHeight: 1.08,
    letterSpacing: "0.01em",
    margin: "0 0 1rem",
    color: PALETTE.text,
  },
  lead: {
    fontSize: "1rem",
    lineHeight: 1.75,
    color: PALETTE.textMuted,
    margin: "0 0 1.75rem",
  },
  btnPrimary: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: TITLE_FONT_STACK,
    fontSize: "0.8rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    textAlign: "center",
    textDecoration: "none",
    color: PALETTE.black,
    background: PALETTE.accent,
    padding: "1.05rem 1.75rem",
    border: "none",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  list: {
    margin: "0 0 2rem",
    padding: 0,
    listStyle: "none",
  },
  listItem: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "flex-start",
    fontSize: "0.95rem",
    lineHeight: 1.6,
    color: PALETTE.textMuted,
    marginBottom: "0.7rem",
  },
  tick: {
    width: 18,
    height: 18,
    flexShrink: 0,
    marginTop: 3,
    background: PALETTE.accent,
    color: PALETTE.white,
    borderRadius: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.65rem",
    fontWeight: 700,
  },
  note: {
    margin: 0,
    padding: "0.9rem 1.1rem",
    background: PALETTE.keyBg,
    borderLeft: `3px solid ${PALETTE.border}`,
    fontSize: "0.88rem",
    lineHeight: 1.6,
    color: PALETTE.textMuted,
  },
  error: {
    margin: "0.9rem 0 0",
    fontSize: "0.88rem",
    lineHeight: 1.6,
    color: PALETTE.danger,
  },
};

/* Shared across both entries: font import, focus rings, hover states. */
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${PALETTE.base}; }
  a { color: ${PALETTE.accent}; }
  button:focus-visible, a:focus-visible {
    outline: 2px solid ${PALETTE.accent};
    outline-offset: 2px;
  }
  .pm-btn:hover:not(:disabled) { background: #96693a !important; }
  .pm-btn:disabled { opacity: 0.6; cursor: default; }
  .pm-copy:hover { background: ${PALETTE.keyBg} !important; color: ${PALETTE.text} !important; }
  @media (prefers-reduced-motion: reduce) { .pm-skeleton { animation: none !important; } }
  @keyframes pm-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
`;
