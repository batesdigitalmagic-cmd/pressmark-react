/*
 * Instant Proof — style tokens.
 *
 * Extends src/blog/theme.js rather than defining a second design system: the
 * same bronze accent, the same navy surfaces, the same Cormorant/Inter pairing
 * and the same page gutter as the marketing site. Only the pieces this tool
 * needs that do not exist elsewhere — step markers, drop zones, swatch inputs,
 * the proof mockup — are added here.
 *
 * blog/theme.js is imported rather than storefront/theme.js because it has no
 * imports of its own and carries the dark surface tokens this page uses.
 */

import { PALETTE, FONT_STACK, TITLE_FONT_STACK, PAGE_X } from "../blog/theme.js";

export { PALETTE, FONT_STACK, TITLE_FONT_STACK, PAGE_X };

export const MAX_W = 1100;

export const IP = {
  page: {
    fontFamily: TITLE_FONT_STACK,
    background: PALETTE.base,
    color: PALETTE.text,
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
  },
  container: {
    width: "100%",
    maxWidth: MAX_W,
    margin: "0 auto",
    padding: `0 ${PAGE_X}`,
  },
  section: {
    padding: "clamp(2.25rem, 5vw, 3.5rem) 0",
  },
  eyebrow: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: PALETTE.accent,
    margin: "0 0 0.9rem",
  },
  stepTitle: {
    fontFamily: FONT_STACK,
    fontSize: "clamp(1.7rem, 3.6vw, 2.5rem)",
    fontWeight: 900,
    lineHeight: 1.12,
    color: PALETTE.text,
    margin: "0 0 0.75rem",
  },
  stepLead: {
    fontSize: "1rem",
    lineHeight: 1.7,
    color: PALETTE.textMuted,
    margin: "0 0 2rem",
    maxWidth: 620,
  },
  card: {
    background: PALETTE.white,
    border: `1px solid ${PALETTE.hairline}`,
    borderRadius: 4,
    padding: "clamp(1.25rem, 3vw, 2rem)",
  },
  label: {
    display: "block",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: PALETTE.accent,
    marginBottom: "0.45rem",
  },
  input: {
    width: "100%",
    padding: "0.75rem 1rem",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.white,
    color: PALETTE.text,
    fontSize: "0.92rem",
    fontFamily: TITLE_FONT_STACK,
    borderRadius: 2,
    outline: "none",
  },
  hint: {
    display: "block",
    marginTop: "0.4rem",
    fontSize: "0.75rem",
    lineHeight: 1.5,
    color: PALETTE.textMuted,
  },
  error: {
    display: "block",
    marginTop: "0.4rem",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#b3261e",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "1.15rem",
  },
  btnPrimary: {
    fontFamily: TITLE_FONT_STACK,
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#000000",
    background: PALETTE.accent,
    border: "none",
    borderRadius: 2,
    padding: "0.95rem 1.9rem",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
    transition: "background 0.2s",
  },
  btnGhost: {
    fontFamily: TITLE_FONT_STACK,
    fontSize: "0.78rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: PALETTE.text,
    background: "transparent",
    border: `1px solid ${PALETTE.border}`,
    borderRadius: 2,
    padding: "0.95rem 1.9rem",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
    transition: "all 0.2s",
  },
  notice: {
    padding: "0.9rem 1.1rem",
    background: PALETTE.paper,
    borderLeft: `3px solid ${PALETTE.accent}`,
    fontSize: "0.85rem",
    lineHeight: 1.6,
    color: PALETTE.textMuted,
    borderRadius: 2,
  },
};

/*
 * Page CSS. Hover, focus and responsive rules live here rather than inline
 * because inline styles cannot express them — the same split the marketing
 * site and blog already use.
 *
 * Animation is deliberately restrained: a progress bar, a soft stage fade and
 * nothing else. This page asks organizations to hand over member photographs;
 * it should read as a production studio, not a product tour.
 */
export const IP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;0,900;1,600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${PALETTE.base}; overflow-x: hidden; }
  /* A phone must never scroll sideways. Wide content (the preview spreads, the
     data tables) scrolls inside its own container instead. */
  html { overflow-x: hidden; }
  img, svg, video { max-width: 100%; }
  a { color: ${PALETTE.accent}; }

  button:focus-visible,
  a:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  [role="radio"]:focus-visible {
    outline: 2px solid ${PALETTE.accent};
    outline-offset: 3px;
  }

  /* Visually hidden but announced — used for "(required)" and step context. */
  .ip-sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0;
  }

  .ip-input:focus { border-color: ${PALETTE.accent}; }
  .ip-input[aria-invalid="true"] { border-color: #b3261e; }

  .ip-btn-primary:hover:not(:disabled) { background: ${PALETTE.accentDeep}; }
  .ip-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .ip-btn-ghost:hover { border-color: ${PALETTE.accent}; color: ${PALETTE.accent}; }

  /* Selectable cards — publication types and style directions. */
  .ip-choice {
    text-align: left;
    width: 100%;
    background: ${PALETTE.white};
    border: 1px solid ${PALETTE.hairline};
    border-radius: 4px;
    padding: 1.15rem 1.25rem;
    cursor: pointer;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
    font-family: inherit;
  }
  .ip-choice:hover { border-color: ${PALETTE.accent}; }
  .ip-choice[aria-checked="true"] {
    border-color: ${PALETTE.accent};
    box-shadow: inset 0 0 0 1px ${PALETTE.accent};
    background: ${PALETTE.paper};
  }

  /*
   * Design selector — compact thumbnails.
   *
   * auto-FILL rather than auto-fit: an empty track keeps its width, so two or
   * three designs stay card-sized instead of stretching across the whole row.
   * That stretching is what let a thumbnail set to width:100% grow to fill a
   * ~350px track and dominate the step.
   */
  .ip-template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 1rem;
  }

  /*
   * The thumbnail is capped independently of the card, so the card can breathe
   * on a wide screen while the preview stays a thumbnail. 8.5:11 is the trim
   * the templates actually are — the artwork is 4:5, so object-fit crops it
   * rather than squashing it.
   */
  .ip-template-thumb {
    width: 100%;
    max-width: 240px;
    margin-inline: auto;
    aspect-ratio: 8.5 / 11;
    overflow: hidden;
    border-radius: 3px;
    background: ${PALETTE.paper};
    border: 1px solid ${PALETTE.hairline};
    display: block;
  }
  .ip-template-thumb img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  /* Drop zone. */
  .ip-drop {
    border: 1px dashed ${PALETTE.border};
    border-radius: 4px;
    background: ${PALETTE.paper};
    padding: clamp(1.5rem, 4vw, 2.25rem);
    text-align: center;
    transition: border-color 0.18s ease, background 0.18s ease;
  }
  .ip-drop[data-dragging="true"] {
    border-color: ${PALETTE.accent};
    border-style: solid;
    background: rgba(170,125,72,0.08);
  }

  .ip-file-remove:hover { color: #b3261e; border-color: #b3261e; }

  /* Stepper. */
  .ip-step-dot {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 50%;
    font-size: 0.72rem; font-weight: 800; flex-shrink: 0;
    border: 1px solid ${PALETTE.border};
    background: ${PALETTE.white}; color: ${PALETTE.textMuted};
  }
  .ip-step[data-state="current"] .ip-step-dot {
    background: ${PALETTE.accent}; border-color: ${PALETTE.accent}; color: #000;
  }
  .ip-step[data-state="done"] .ip-step-dot {
    background: ${PALETTE.ink}; border-color: ${PALETTE.ink}; color: ${PALETTE.white};
  }
  .ip-step[data-state="current"] .ip-step-label { color: ${PALETTE.text}; font-weight: 700; }

  /* Progress. */
  .ip-progress-track {
    height: 4px; border-radius: 99px; overflow: hidden;
    background: rgba(2,8,20,0.1);
  }
  .ip-progress-fill {
    height: 100%; background: ${PALETTE.accent};
    transition: width 0.5s ease;
  }
  .ip-stage { transition: color 0.3s ease, opacity 0.3s ease; }

  /* Proof mockup — a printed book, not a browser window. */
  .ip-book {
    position: relative;
    box-shadow: 0 24px 60px rgba(2,8,20,0.28);
    border-radius: 2px;
    overflow: hidden;
  }
  @media (max-width: 900px) {
    .ip-choice-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important; }
    .ip-stepper { overflow-x: auto; }
    .ip-review-grid { grid-template-columns: minmax(0, 1fr) !important; }
    .ip-result-actions { flex-direction: column; align-items: stretch; }
    .ip-result-actions > * { width: 100%; text-align: center; }
  }
  /*
   * ── Mobile ──
   *
   * The Quick Proof flow is used on a phone, standing in a school hall, with
   * one thumb. Everything below serves that.
   */

  /* 44px is the smallest target most people can hit reliably. Applied as a
     minimum rather than a fixed size so text can still set the height. */
  .ip-touch {
    min-height: 44px;
    min-width: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* The two primary upload actions. Deliberately large. */
  .ip-upload-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  .ip-upload-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 116px;
    padding: 1.1rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    text-align: center;
    transition: border-color 0.18s ease, background 0.18s ease;
  }
  .ip-upload-btn:hover { border-color: ${PALETTE.accent}; }

  /* Photo thumbnails. auto-fill keeps them a sensible size at every width
     instead of stretching two photos across a tablet. */
  .ip-photo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 0.6rem;
  }
  .ip-photo-tile {
    position: relative;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    border-radius: 4px;
    background: ${PALETTE.paper};
    border: 1px solid ${PALETTE.hairline};
  }
  /* object-fit keeps a portrait a portrait; a phone photo is never stretched. */
  .ip-photo-tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ip-photo-tile[data-excluded="true"] img { opacity: 0.35; filter: grayscale(1); }

  .ip-photo-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    background: rgba(2, 8, 20, 0.72);
    color: #fff;
    font-size: 0.95rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* The visible control is 30px for the sake of the picture, but the tap
     target it exposes is 44px. */
  .ip-photo-remove::after {
    content: "";
    position: absolute;
    inset: -7px;
  }
  .ip-photo-remove:hover { background: #b3261e; }

  /* Disclosures — "Add details", "Add organization details". */
  .ip-disclosure > summary {
    list-style: none;
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ip-disclosure > summary::-webkit-details-marker { display: none; }
  .ip-disclosure > summary:focus-visible {
    outline: 2px solid ${PALETTE.accent};
    outline-offset: 3px;
  }
  .ip-disclosure-caret { transition: transform 0.2s ease; }
  .ip-disclosure[open] .ip-disclosure-caret { transform: rotate(90deg); }

  @media (max-width: 700px) {
    /* Mapping and reconciliation rows are three columns on desktop; stacking
       them keeps the select usable at thumb width instead of 90px wide. */
    .ip-mapping-row { grid-template-columns: minmax(0, 1fr) !important; gap: 0.5rem !important; }
    .ip-mapping-row > span[aria-hidden] { display: none !important; }
  }
  @media (max-width: 560px) {
    .ip-choice-grid { grid-template-columns: minmax(0, 1fr) !important; }
    /* One design per row on a phone, so the name and description stay
       readable, with a smaller thumbnail above them. */
    .ip-template-grid { grid-template-columns: minmax(0, 1fr); }
    .ip-template-thumb { max-width: 180px; }
    /* Stacked, full width, thumb-sized. */
    .ip-upload-actions { grid-template-columns: minmax(0, 1fr); }
    .ip-upload-btn { min-height: 92px; }
    .ip-photo-grid { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); }
    .ip-detail-grid { grid-template-columns: minmax(0, 1fr) !important; }
    .ip-nav-row { flex-direction: column-reverse; align-items: stretch; gap: 0.75rem; }
    .ip-nav-row > * { width: 100%; text-align: center; }
    .ip-metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ip-progress-fill, .ip-stage, .ip-choice, .ip-drop { transition: none !important; }
  }

  @media print {
    .ip-no-print { display: none !important; }
  }
`;
