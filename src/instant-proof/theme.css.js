/*
 * The Instant Proof visual system.
 *
 * One stylesheet rather than inline styles scattered across twenty components:
 * the redesign is a system — gold labels, black display type, outlined option
 * buttons, thin gold rules — and a system belongs in one place where it can be
 * kept consistent.
 *
 * Everything is scoped under .ip-root. The marketing site, blog and storefront
 * are untouched.
 *
 * Designed at 390px first. Verified at 320, 375, 390, 430 and 1440.
 */

import { PROOF_TOKENS_CSS } from "./tokens.js";

export const PROOF_CSS = `
${PROOF_TOKENS_CSS}

  .ip-root {
    background: var(--proof-paper);
    color: var(--proof-ink-soft);
    font-family: var(--proof-body);
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    /* Nothing on a phone may scroll the page sideways. Wide things — the
       carousel, preview spreads, data tables — scroll inside themselves. */
    overflow-x: clip;
  }
  .ip-root *, .ip-root *::before, .ip-root *::after { box-sizing: border-box; }
  .ip-root img, .ip-root svg { max-width: 100%; }

  /* ── Page frame ───────────────────────────────────────────────── */

  .ip-page {
    width: 100%;
    /* Centred and capped: never stretched across a desktop. */
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--proof-pad);
  }
  /*
   * Rules run edge to edge while the content stays inset.
   *
   * width:100% does NOT do that inside a padded container — it gives the
   * content width, leaving the rule inset by the gutter. Cancelling the padding
   * with a negative margin is what actually reaches the edges. It tracks
   * --proof-pad, so it stays correct when the gutter changes at other widths.
   */
  .ip-bleed {
    margin-inline: calc(-1 * var(--proof-pad));
  }
  .ip-rule { height: 1px; background: var(--proof-line); border: 0; margin: 0; }

  /* ── Type ─────────────────────────────────────────────────────── */

  .ip-eyebrow {
    font-family: var(--proof-body);
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--proof-gold);
    margin: 0;
  }
  .ip-h1 {
    font-family: var(--proof-display);
    font-weight: 900;
    font-size: clamp(1.85rem, 8.2vw, 2.6rem);
    line-height: 1.04;
    letter-spacing: -0.03em;
    color: var(--proof-ink);
    margin: var(--proof-space-3) 0 0;
    /* A long heading wraps rather than clipping at 320px. */
    overflow-wrap: break-word;
  }
  .ip-lead {
    font-size: 0.97rem;
    line-height: 1.5;
    color: var(--proof-ink-soft);
    margin: var(--proof-space-4) 0 0;
    max-width: 34em;
  }
  .ip-label {
    display: block;
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: 0.045em;
    text-transform: uppercase;
    color: var(--proof-gold);
    margin: 0 0 var(--proof-space-3);
  }
  .ip-note { font-size: 0.88rem; line-height: 1.5; color: var(--proof-ink-soft); margin: 0; }
  .ip-muted { color: var(--proof-muted); }

  .ip-sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%);
    white-space: nowrap; border: 0;
  }

  /* Focus is always visible, and never only a colour change. */
  .ip-root :is(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
    outline: 3px solid var(--proof-navy);
    outline-offset: 2px;
  }

  /* ── Fieldsets ────────────────────────────────────────────────── */

  .ip-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
  .ip-legend { padding: 0; }

  /* ── Build-method cards ───────────────────────────────────────── */

  /* Two equal columns at every width, including 320px — the reference keeps
     them side by side and stacking them would lose the comparison. */
  .ip-methods {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--proof-space-4);
  }
  .ip-method { display: flex; flex-direction: column; gap: var(--proof-space-3); min-width: 0; }
  /*
   * A normal button, not a square tile. The reference drew these as large
   * squares, but at 165px wide that is 165px tall — a third of a phone screen
   * spent on two words, pushing the publication list below the fold. Sized as a
   * rectangle they read the same and the whole step fits in one view.
   *
   * min-height rather than height, so a label that wraps to two lines at 320px
   * grows the button instead of overflowing it.
   */
  .ip-method-btn {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--proof-space-3) var(--proof-space-2);
    border: 2px solid var(--proof-gold);
    border-radius: var(--proof-radius);
    background: var(--proof-gold);
    color: var(--proof-ink);
    font-family: var(--proof-display);
    font-weight: 900;
    font-size: clamp(0.95rem, 4.1vw, 1.15rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  /* Unselected reads as an outline, so selection is not carried by colour
     alone — the fill, the border and the tick all change. */
  .ip-method-btn[aria-checked="false"] {
    background: var(--proof-surface);
    border-color: var(--proof-line);
  }
  .ip-method-btn[aria-checked="true"] { box-shadow: inset 0 0 0 2px var(--proof-ink); }
  .ip-method-cap { font-size: 0.92rem; line-height: 1.35; color: var(--proof-ink-soft); }

  /* ── Publication list ─────────────────────────────────────────── */

  .ip-pubs { display: grid; gap: var(--proof-space-3); }
  .ip-pub {
    display: flex;
    align-items: center;
    gap: var(--proof-space-3);
    width: 100%;
    min-height: 52px;
    padding: var(--proof-space-3) var(--proof-space-4);
    border: 1.5px solid var(--proof-line);
    border-radius: var(--proof-radius);
    background: var(--proof-surface);
    color: var(--proof-ink);
    font-family: var(--proof-display);
    font-weight: 900;
    font-size: clamp(1.02rem, 4.6vw, 1.25rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .ip-pub[aria-checked="true"] {
    border-color: var(--proof-gold);
    background: var(--proof-gold-soft);
    box-shadow: inset 0 0 0 1px var(--proof-gold);
  }
  /* A tick, so selection survives greyscale and colour blindness. */
  .ip-pub-tick {
    flex: 0 0 auto;
    width: 20px; height: 20px;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid var(--proof-line);
    border-radius: 50%;
    font-size: 0.7rem; font-weight: 900;
    color: transparent;
  }
  .ip-pub[aria-checked="true"] .ip-pub-tick {
    background: var(--proof-gold); border-color: var(--proof-gold); color: #fff;
  }

  /* ── Design carousel ──────────────────────────────────────────── */

  .ip-carousel-hint {
    display: flex; align-items: center; justify-content: center; gap: var(--proof-space-2);
    font-size: 0.72rem; font-weight: 800; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--proof-ink);
    margin: 0 0 var(--proof-space-2);
  }
  .ip-carousel {
    display: flex;
    gap: var(--proof-space-3);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    /* Bleed to the page edges so a partially visible neighbour signals that
       there is more to scroll to. */
    margin-inline: calc(-1 * var(--proof-pad));
    padding: var(--proof-space-1) var(--proof-pad) var(--proof-space-4);
    scroll-padding-inline: var(--proof-pad);
    /* Scrollable, but without a permanent bar over the artwork. */
    scrollbar-width: none;
  }
  .ip-carousel::-webkit-scrollbar { display: none; }
  .ip-slide {
    flex: 0 0 var(--proof-thumb-w);
    scroll-snap-align: center;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    display: block;
  }
  .ip-slide-frame {
    width: 100%;
    aspect-ratio: var(--proof-cover-ratio);
    overflow: hidden;
    border-radius: var(--proof-radius-sm);
    border: 2px solid transparent;
    background: var(--proof-surface);
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .ip-slide-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .ip-slide[aria-checked="true"] .ip-slide-frame {
    border-color: var(--proof-gold);
    transform: scale(1.03);
  }
  .ip-slide[aria-checked="false"] .ip-slide-frame { opacity: 0.72; }

  .ip-design-name {
    font-family: var(--proof-display);
    font-weight: 900;
    font-size: clamp(1.25rem, 5.4vw, 1.6rem);
    letter-spacing: -0.02em;
    color: var(--proof-navy);
    text-align: center;
    margin: 0 0 var(--proof-space-3);
  }
  .ip-design-state {
    display: flex; align-items: center; justify-content: center; gap: var(--proof-space-2);
    min-height: 44px;
    margin: 0 auto;
    padding: 0 var(--proof-space-5);
    border: 2px solid var(--proof-gold);
    border-radius: var(--proof-radius);
    background: var(--proof-gold);
    color: var(--proof-ink);
    font-size: 0.82rem; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase;
    font-family: var(--proof-body);
  }
  .ip-linkish {
    background: none; border: 0; padding: 8px;
    min-height: 44px;
    color: var(--proof-navy);
    font-size: 0.82rem; font-weight: 700;
    text-decoration: underline; text-underline-offset: 3px;
    cursor: pointer; font-family: var(--proof-body);
  }

  /* ── Buttons ──────────────────────────────────────────────────── */

  .ip-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 48px;
    padding: 0 var(--proof-space-5);
    border-radius: var(--proof-radius);
    font-family: var(--proof-body);
    font-size: 0.88rem; font-weight: 800; letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer; text-decoration: none;
    border: 2px solid transparent;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .ip-btn-primary { background: var(--proof-navy); color: #fff; border-color: var(--proof-navy); }
  .ip-btn-primary:hover:not(:disabled) { background: var(--proof-navy-deep); }
  .ip-btn-primary:disabled { background: var(--proof-hairline); border-color: transparent; color: var(--proof-muted); cursor: not-allowed; }
  .ip-btn-ghost { background: transparent; color: var(--proof-ink); border-color: var(--proof-line); }
  .ip-btn-gold { background: var(--proof-gold); color: var(--proof-ink); border-color: var(--proof-gold); }
  .ip-btn-block { width: 100%; }

  /* ── Sticky action bar ────────────────────────────────────────── */

  .ip-actions {
    position: sticky;
    bottom: 0;
    z-index: 40;
    background: var(--proof-paper);
    border-top: 1px solid var(--proof-line);
    /* Respect the home indicator on an iPhone. */
    padding: var(--proof-space-3) var(--proof-pad)
             calc(var(--proof-space-3) + env(safe-area-inset-bottom, 0px));
    display: flex;
    gap: var(--proof-space-3);
    align-items: center;
  }
  .ip-actions .ip-btn-primary { flex: 1; }
  .ip-actions-why {
    font-size: 0.78rem; line-height: 1.4; color: var(--proof-muted);
    margin: 0 0 var(--proof-space-2);
  }
  /* The bar must never sit on top of the last section. */
  .ip-actions-spacer { height: var(--proof-space-5); }

  /* ── Sections ─────────────────────────────────────────────────── */

  .ip-section { padding: var(--proof-space-6) 0 0; }
  .ip-section-tight { padding: var(--proof-space-5) 0 0; }

  /* The sticky design reminder is a desktop affordance; on a phone the
     carousel is right there and a second copy would be noise. */
  .ip-desktop-only { display: none; }

  /* ── Desktop ──────────────────────────────────────────────────── */

  @media (min-width: 900px) {
    .ip-desktop-only { display: block; }
    /* Raise the gutter itself rather than overriding .ip-page's padding, so
       .ip-bleed's negative margin still matches it exactly. */
    .ip-root { --proof-pad: 32px; }
    /* Selections left, a restrained sticky design preview right. */
    .ip-create {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: var(--proof-space-7);
      align-items: start;
    }
    .ip-aside {
      position: sticky;
      top: var(--proof-space-5);
      max-width: 300px;
    }
    .ip-aside-frame {
      width: 100%;
      max-width: 260px;
      margin-inline: auto;
      aspect-ratio: var(--proof-cover-ratio);
      overflow: hidden;
      border: 1px solid var(--proof-line);
      border-radius: var(--proof-radius-sm);
    }
    .ip-aside-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
    /* On a desktop the action bar is part of the flow, not pinned. */
    .ip-actions { position: static; border-top: 1px solid var(--proof-line); }
    .ip-actions .ip-btn-primary { flex: 0 0 auto; min-width: 260px; }
    .ip-methods { gap: var(--proof-space-5); }
    .ip-method-btn { min-height: 64px; font-size: 1.2rem; }
  }

  @media (min-width: 1200px) {
    .ip-page { max-width: 1040px; }
  }

  /* ── Narrow phones ────────────────────────────────────────────── */

  @media (max-width: 359px) {
    .ip-root { --proof-pad: 16px; --proof-thumb-w: 128px; }
    .ip-method-btn { font-size: 0.92rem; }
    .ip-pub { font-size: 0.97rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ip-root *, .ip-root *::before, .ip-root *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    .ip-slide[aria-checked="true"] .ip-slide-frame { transform: none; }
  }
`;
