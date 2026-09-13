/*
 * The Instant Proof visual system.
 *
 * One stylesheet rather than inline styles scattered across twenty components:
 * the redesign is a system — maroon labels, black display type, quiet grey
 * buttons, thin maroon rules — and a system belongs in one place where it can be
 * kept consistent.
 *
 * Everything is scoped under .ip-root. The marketing site, blog and storefront
 * are untouched.
 *
 * Designed at 390px first. Verified at 320, 375, 390, 430 and 1440.
 */

import { FONT_FAMILY } from "../fonts.js";
import { BUTTON } from "../palette.js";
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

  /*
   * Every section carries top padding only (.ip-section), so the last one on a
   * page ends flush against the dark footer with nothing between them. The
   * gutter belongs to the main region rather than to .ip-page, which is also
   * used inside the step flow where .ip-actions-spacer already does this job.
   */
  .ip-main { flex: 1; padding-bottom: var(--proof-space-7); }

  /* ── Type ─────────────────────────────────────────────────────── */

  .ip-eyebrow {
    font-family: var(--proof-body);
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--proof-accent);
    margin: 0;
  }
  .ip-h1 {
    font-family: var(--proof-display);
    font-weight: 700;
    font-size: clamp(1.85rem, 8.2vw, 2.6rem);
    line-height: 1.06;
    /*
     * -0.01em, not -0.03em. The tighter tracking was compensating for a
     * synthesised black weight in a system sans; News Gothic Std is already a
     * narrow grotesque and at -0.03em its Bold sets too tight to read at size.
     */
    letter-spacing: -0.01em;
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
    font-weight: 700;
    letter-spacing: 0.045em;
    text-transform: uppercase;
    color: var(--proof-accent);
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
    border: 2px solid var(--proof-accent);
    border-radius: var(--proof-radius);
    background: var(--proof-accent);
    color: var(--proof-ink);
    font-family: var(--proof-display);
    font-weight: 700;
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
    font-weight: 700;
    font-size: clamp(1.02rem, 4.6vw, 1.25rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .ip-pub[aria-checked="true"] {
    border-color: var(--proof-accent);
    background: var(--proof-accent-soft);
    box-shadow: inset 0 0 0 1px var(--proof-accent);
  }
  /* A tick, so selection survives greyscale and colour blindness. */
  .ip-pub-tick {
    flex: 0 0 auto;
    width: 20px; height: 20px;
    display: flex; align-items: center; justify-content: center;
    border: 1.5px solid var(--proof-line);
    border-radius: 50%;
    font-size: 0.7rem; font-weight: 700;
    color: transparent;
  }
  .ip-pub[aria-checked="true"] .ip-pub-tick {
    background: var(--proof-accent); border-color: var(--proof-accent); color: #fff;
  }

  /* ── Design carousel ──────────────────────────────────────────── */

  .ip-carousel-hint {
    display: flex; align-items: center; justify-content: center; gap: var(--proof-space-2);
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.16em;
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
    border-color: var(--proof-accent);
    transform: scale(1.03);
  }
  .ip-slide[aria-checked="false"] .ip-slide-frame { opacity: 0.72; }

  .ip-design-name {
    font-family: var(--proof-display);
    font-weight: 700;
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
    border: 2px solid var(--proof-accent);
    border-radius: var(--proof-radius);
    background: var(--proof-accent);
    color: var(--proof-ink);
    font-size: 0.82rem; font-weight: 700; letter-spacing: 0.08em;
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

  /*
   * Every button is the Google Search key: light grey, sentence case, regular
   * weight, a hairline and a one-pixel shadow that appear only on hover. The
   * values come from BUTTON in src/palette.js, which the blog, the storefront
   * and the consent banner read too.
   *
   * The primary, ghost and gold variants used to be three different colours.
   * They are one look now; the classes stay only because markup still names
   * them, and a variant that meant something would need a reason to exist.
   */
  .ip-btn,
  .ip-menu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: ${BUTTON.height};
    padding: 0 ${BUTTON.paddingX};
    border: 1px solid ${BUTTON.border};
    border-radius: ${BUTTON.radius};
    background: ${BUTTON.background};
    color: ${BUTTON.text};
    font-family: var(--proof-body);
    font-size: ${BUTTON.fontSize};
    font-weight: 400;
    letter-spacing: normal;
    text-transform: none;
    line-height: 1.2;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
    transition: border-color 0.1s ease, box-shadow 0.1s ease, color 0.1s ease;
  }
  .ip-btn:hover:not(:disabled):not([aria-disabled="true"]),
  .ip-menu-btn:hover {
    border-color: ${BUTTON.borderHover};
    box-shadow: ${BUTTON.shadowHover};
    color: ${BUTTON.textHover};
  }

  /* Google's page can afford 36px because nobody taps that button on a phone.
     Every button here is a way through the tool, so a touch screen gets 44. */
  @media (pointer: coarse) {
    .ip-btn, .ip-menu-btn { min-height: ${BUTTON.touchHeight}; }
    .ip-icon-btn { width: ${BUTTON.touchHeight}; height: ${BUTTON.touchHeight}; }
  }

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

  /* ── The blank-template offer ──────────────────────────────────
     Button above, caption beneath, one column at every width. Stacked
     rather than side-by-side so nothing has to reflow on a phone, and so
     the caption never gets squeezed into a two-word-per-line column. */

  .ip-template-offer {
    display: grid;
    justify-items: start;
    gap: var(--proof-space-3);
  }
  .ip-template-download {
    display: grid;
    place-items: center;
    gap: 2px;
    /* Square, and comfortably past the 44px minimum tap target. */
    width: 78px;
    height: 78px;
    border: 1.5px solid var(--proof-line);
    border-radius: var(--proof-radius);
    background: var(--proof-surface);
    color: var(--proof-ink);
    text-decoration: none;
    line-height: 1;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .ip-template-download:hover,
  .ip-template-download:focus-visible {
    border-color: var(--proof-accent);
    background: var(--proof-paper);
  }
  .ip-template-arrow { font-size: 1.5rem; color: var(--proof-accent); }
  .ip-template-kind {
    /* 12.5px. Anything under 12px is uncomfortable on a phone, and a caps
       label with letter-spacing reads smaller than its size suggests. */
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  /* Measure, not width: a caption running the full width of a tablet is
     harder to read than one that wraps at a sensible line length. */
  .ip-template-caption { margin: 0; max-width: 46ch; }

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

/*
 * ── The workspace shell ──
 *
 * Everything above styles the page's CONTENT. This styles the room it sits in:
 * a quiet left sidebar on a desktop, a compact bar and a drawer on a phone, and
 * a single column of cards in the middle at every width.
 *
 * It is a separate export rather than more of PROOF_CSS so a page can be read
 * as either — content in a shell, or content on its own — and so the diff that
 * introduced the shell did not touch a single verified rule above.
 */
export const SHELL_CSS = `
  /*
   * The one rule here that is not scoped to .ip-root.
   *
   * The shell IS the page on every route it serves, and a default 8px body
   * margin would put a white border around a full-height workspace. src/index.css
   * used to do this, along with centring every heading and forcing a serif on
   * h1/h2 — which is why the tool no longer loads it.
   */
  body { margin: 0; }

  /* ── Skip link ── */

  .ip-skip {
    position: absolute;
    left: -9999px;
    top: 0;
    z-index: 60;
    background: var(--proof-ink);
    color: #fff;
    padding: 12px 16px;
    border-radius: 0 0 var(--proof-radius) 0;
    font-size: 0.9rem;
  }
  .ip-skip:focus { left: 0; }

  /* ── Frame ── */

  .ip-app { width: 100%; flex: 1; display: flex; flex-direction: column; }

  /* ── Mobile bar ── */

  .ip-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--proof-space-3);
    padding: 10px var(--proof-pad);
    background: var(--proof-surface);
    border-bottom: 1px solid var(--proof-border);
  }
  .ip-topbar-logo { display: flex; align-items: center; min-height: 44px; }
  .ip-topbar-logo img { display: block; height: 30px; width: auto; }

  /* A 44px square that reads as a control without a border around it. */
  /* The Menu button's skin is the shared one under "Buttons" above. It only
     sits in the phone bar, so it always gets the 44px touch height. */
  .ip-menu-btn { min-height: 44px; min-width: 44px; padding: 0 12px; }
  .ip-menu-bars { display: grid; gap: 3px; }
  .ip-menu-bars span { display: block; width: 16px; height: 2px; background: currentColor; }

  /* ── Sidebar ── */

  .ip-sidebar {
    /*
     * Off-canvas by default; the desktop query below puts it back in the flow.
     * Phone-first, as the rest of this stylesheet is.
     */
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 45;
    width: min(84vw, 300px);
    display: flex;
    flex-direction: column;
    gap: var(--proof-space-5);
    padding: var(--proof-space-5) var(--proof-space-5) var(--proof-space-6);
    background: var(--proof-surface);
    border-right: 1px solid var(--proof-border);
    overflow-y: auto;
    overscroll-behavior: contain;
    transform: translateX(-100%);
    /*
     * visibility, not just transform.
     *
     * A drawer moved off-screen with a transform is still in the tab order and
     * still read by a screen reader, so a keyboard user tabs into links they
     * cannot see. visibility:hidden takes it out of both, and transitioning it
     * alongside the transform means it becomes visible as the panel starts
     * moving in rather than popping.
     */
    visibility: hidden;
    transition: transform 0.22s ease, visibility 0.22s;
  }
  .ip-sidebar[data-open="true"] { transform: none; visibility: visible; }
  /*
   * Nothing in the sidebar shrinks.
   *
   * It is a flex column, so on a short window the items compressed to fit
   * instead of scrolling — the logo lost its top padding and was squeezed under
   * its own image, and overflow-y: auto never engaged because scrollHeight
   * matched clientHeight exactly. With flex:none the content keeps its size and
   * the sidebar scrolls, which is what it was already set up to do.
   */
  .ip-sidebar > * { flex: none; }
  .ip-scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(17, 20, 24, 0.42);
    border: 0;
    padding: 0;
  }

  /*
   * justify-content, not text-align or a margin.
   *
   * As a flex item this anchor is stretched to the sidebar's full width, so the
   * artwork sat at its left edge — the logo looked left-aligned while the box
   * around it was already centred. Centring the anchor's own content is what
   * actually moves the mark.
   */
  .ip-sidebar-logo {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: calc(var(--nav-dot) + var(--nav-gap));
    min-height: 44px;
  }
  /*
   * Height, not width: the lockup is portrait, and a width on portrait artwork
   * is a height nobody chose.
   *
   * It also gives way on a short window rather than pushing the navigation out
   * of view — 150px on a laptop, less on anything shorter than about 1150px.
   */
  .ip-sidebar-logo img {
    display: block;
    height: clamp(104px, 13vh, 150px);
    width: auto;
    max-width: 100%;
  }

  /*
   * A nav label does not start at the sidebar's content edge — the marker dot
   * and its gap push it in. The logo is indented by exactly that, so its left
   * edge lines up with "Create a Proof" rather than with the box around it.
   */
  .ip-sidebar { --nav-dot: 6px; --nav-gap: 10px; }
  .ip-nav { display: flex; flex-direction: column; }
  .ip-nav-group + .ip-nav-group {
    margin-top: var(--proof-space-4);
    padding-top: var(--proof-space-4);
    border-top: 1px solid var(--proof-border);
  }
  .ip-nav-item {
    display: flex;
    align-items: center;
    gap: var(--nav-gap);
    min-height: 44px;
    padding: 0 10px;
    margin: 0 -10px;
    border-radius: var(--proof-radius);
    color: var(--proof-ink-soft);
    text-decoration: none;
    font-size: 0.95rem;
  }
  .ip-nav-item:hover { background: rgba(17, 20, 24, 0.04); }
  /* Current page: weight and a filled ground, no coloured bar. One accent, used
     sparingly, is the whole visual argument of this page. */
  .ip-nav-item[aria-current="page"] {
    background: rgba(17, 20, 24, 0.06);
    color: var(--proof-ink);
    font-weight: 500;
  }
  .ip-nav-dot {
    width: var(--nav-dot);
    height: var(--nav-dot);
    border-radius: 50%;
    background: var(--proof-accent);
    opacity: 0;
    flex: 0 0 auto;
  }
  .ip-nav-item[aria-current="page"] .ip-nav-dot { opacity: 1; }

  /* Outside the workspace, so the default link style never reached it and it
     rendered in the browser's own blue. */
  .ip-sidebar-foot a { color: var(--proof-muted); text-underline-offset: 2px; }
  .ip-sidebar-foot a:hover { color: var(--proof-accent); }
  .ip-sidebar-foot {
    margin-top: auto;
    display: grid;
    gap: var(--proof-space-2);
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--proof-muted);
  }

  /* ── Workspace ── */

  /*
   * The workspace's own breathing room.
   *
   * On a phone the crumb used to start immediately under the sticky top bar,
   * which read as the heading being pinned to the chrome rather than sitting on
   * a page. The desktop query below opens it further, where there is more room
   * to give.
   */
  .ip-workspace {
    flex: 1;
    padding-top: var(--proof-space-6);
    padding-bottom: var(--proof-space-7);
  }
  .ip-crumb {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--proof-muted);
    margin: 0 0 var(--proof-space-2);
  }
  .ip-shell-foot {
    margin-top: var(--proof-space-7);
    padding-top: var(--proof-space-4);
    border-top: 1px solid var(--proof-border);
    display: flex;
    flex-wrap: wrap;
    gap: var(--proof-space-2) var(--proof-space-5);
    align-items: center;
    font-size: 0.78rem;
    color: var(--proof-muted);
  }
  .ip-shell-foot a { color: var(--proof-muted); }

  /* ── Cards ── */

  .ip-card {
    background: var(--proof-surface);
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-lg);
    padding: var(--proof-space-5);
    box-shadow: var(--proof-shadow);
  }
  .ip-card + .ip-card { margin-top: var(--proof-space-4); }
  /*
   * wrap, because the tag must not be pushed past the card's edge.
   *
   * On a phone the design card's title takes three lines and "AVAILABLE NOW"
   * has nowhere left to sit on the same row; without wrapping it was clipped at
   * the column boundary. Wrapped, it drops under the title and stays whole.
   */
  .ip-card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--proof-space-2) var(--proof-space-3);
  }
  .ip-card-title { font-size: 1.02rem; font-weight: 500; color: var(--proof-ink); margin: 0; }

  .ip-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--proof-border);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--proof-muted);
    white-space: nowrap;
  }
  .ip-tag-live { border-color: rgba(34, 80, 60, 0.4); color: #22503c; }

  /* ── Step rail ── */

  .ip-steps { list-style: none; margin: 0 0 var(--proof-space-5); padding: 0; display: grid; gap: 2px; }
  .ip-step {
    display: flex;
    align-items: center;
    gap: var(--proof-space-3);
    padding: 8px 0;
    color: var(--proof-muted);
    font-size: 0.92rem;
  }
  /*
   * The rail is in the InDesign scheme: deep maroon for where you are, pink for
   * what is finished. It is the one part of the page that describes the machine
   * doing the work rather than the studio, and the two colours come from the
   * Pressmark mark, whose arrow runs between exactly them.
   */
  .ip-step-n {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid var(--proof-id-soft);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--proof-muted);
    background: var(--proof-surface);
  }
  .ip-step[data-state="current"] { color: var(--proof-ink); font-weight: 500; }
  .ip-step[data-state="current"] .ip-step-n {
    border-color: var(--proof-id-ink);
    background: var(--proof-id-ink);
    color: #fff;
  }
  .ip-step[data-state="done"] { color: var(--proof-ink-soft); }
  .ip-step[data-state="done"] .ip-step-n {
    border-color: var(--proof-id-pink);
    background: var(--proof-id-pink);
    color: #fff;
  }

  /* ── Design cards ── */

  .ip-designs { display: grid; gap: var(--proof-space-3); margin-top: var(--proof-space-5); }
  .ip-design {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: var(--proof-space-3);
    align-items: center;
    width: 100%;
    text-align: left;
    background: var(--proof-surface);
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-lg);
    padding: var(--proof-space-3);
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  /* Selection is a ring rather than a thicker border: a border that changes
     width reflows the card's contents by a pixel as it is chosen. */
  .ip-design[aria-pressed="true"] {
    border-color: var(--proof-ink);
    box-shadow: 0 0 0 1px var(--proof-ink);
  }
  .ip-design[aria-disabled="true"] { cursor: not-allowed; opacity: 0.72; }
  .ip-design-thumb {
    width: 52px;
    aspect-ratio: var(--proof-cover-ratio);
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-sm);
    overflow: hidden;
    background: var(--proof-paper);
  }
  .ip-design-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /*
   * Not .ip-design-name — that belongs to the old carousel, where it is a 26px
   * centred display face. A card in a workspace wants neither.
   */
  .ip-design-title { font-weight: 500; color: var(--proof-ink); font-size: 1rem; }
  /* display:block because these are spans inside a <button> — a button may not
     contain <p>, and an inline span drops its top margin, which ran the two
     paragraphs of the unavailable card together into one. */
  .ip-design-body { display: block; }
  .ip-design-desc { display: block; margin: 6px 0 0; font-size: 0.9rem; color: var(--proof-muted); line-height: 1.5; }

  /* ── Live preview ── */

  .ip-preview {
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-lg);
    overflow: hidden;
    background: var(--proof-preview-bg);
  }
  .ip-preview-bar { height: 10px; background: var(--proof-preview-primary); }
  .ip-preview-body { padding: var(--proof-space-3); }
  .ip-preview-title {
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--proof-preview-primary);
    margin: 0 0 2px;
  }
  .ip-preview-sub { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--proof-muted); margin: 0 0 var(--proof-space-3); }
  .ip-preview-entry { padding: 8px 0; border-top: 1px solid var(--proof-preview-accent); font-size: 0.78rem; line-height: 1.45; }
  .ip-preview-entry strong { color: var(--proof-preview-text); display: block; }
  .ip-preview-entry span { color: var(--proof-muted); }
  .ip-preview-note { font-size: 0.72rem; margin-top: var(--proof-space-2); }
  .ip-preview-rule { height: 8px; background: var(--proof-preview-tint); margin-top: var(--proof-space-3); }

  /* ── Boot screen ── */

  /*
   * A launch screen, not a loader.
   *
   * Ink rather than paper: it reads as the application opening rather than as a
   * page that has failed to paint, and it gives the wordmark a moment on its own
   * before the workspace arrives. The cross-fade to the light workspace is
   * carried by the same animation that removes it, so there is no flash between
   * the two.
   *
   * Everything here is CSS. A timer that drifted or was starved by React work
   * would hold a splash over a working page, which is the one failure this must
   * not have; the only JS involved removes the element after the animation.
   */
  /*
   * Its own colours, not the tokens.
   *
   * The launch screen is rendered OUTSIDE .ip-root — it is a sibling of the
   * shell, so that it covers everything and can be removed without touching the
   * page beneath. Every --proof-* custom property is declared on .ip-root, so
   * none of them resolves here: written with tokens, this had no background at
   * all and the mark floated over the workspace.
   *
   * Two literals and a spacing value are the whole cost of being self-contained.
   */
  .ip-boot {
    --boot-ink: #0b111c;
    /* The pink from the mark directly above it, not the gold. On the launch
       screen the bar reads as part of the logo; two accents an inch apart do
       not. */
    --boot-accent: #ef3b6a;
    /* Named outright for the same reason the colours are: this element is
       outside .ip-root, so it inherits neither the tokens nor the family, and
       without this the tagline set in the browser's default serif. */
    font-family: ${FONT_FAMILY};
    position: fixed;
    inset: 0;
    /*
     * Above the analytics consent banner, which sits at 2147483000 (see
     * src/consent.js). A launch screen with a cookie notice stapled across the
     * bottom of it is not a launch screen.
     */
    z-index: 2147483001;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 24px;
    padding: 22px;
    text-align: center;
    background: var(--boot-ink);
    animation: ip-boot-out 0.42s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    animation-delay: 0.78s;
  }
  /* A slow drift of light behind the mark. One gradient, no images. */
  .ip-boot::before {
    content: "";
    position: absolute;
    inset: -30%;
    background:
      radial-gradient(38% 30% at 50% 42%, rgba(239, 59, 106, 0.16), transparent 70%),
      radial-gradient(60% 45% at 50% 58%, rgba(255, 255, 255, 0.05), transparent 70%);
    animation: ip-boot-breathe 3.2s ease-in-out infinite;
  }
  .ip-boot > * { position: relative; }
  .ip-boot img {
    height: min(220px, 34vh);
    width: auto;
    max-width: 70vw;
    animation: ip-boot-rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }
  .ip-boot p {
    margin: 0;
    font-size: 0.85rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.62);
    animation: ip-boot-rise 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) 0.1s both;
  }
  .ip-boot-track {
    width: min(200px, 54vw);
    height: 1px;
    background: rgba(255, 255, 255, 0.16);
    overflow: hidden;
  }
  .ip-boot-fill {
    display: block;
    height: 100%;
    width: 45%;
    background: var(--boot-accent);
    animation: ip-boot-slide 1.05s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  }
  @keyframes ip-boot-slide {
    0% { transform: translateX(-105%); }
    100% { transform: translateX(325%); }
  }
  @keyframes ip-boot-rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  @keyframes ip-boot-breathe {
    0%, 100% { opacity: 0.75; }
    50% { opacity: 1; }
  }
  @keyframes ip-boot-out {
    to { opacity: 0; visibility: hidden; }
  }

  /* ── Composer ── */

  /*
   * Every action on the tool page, in one bar.
   *
   * On a phone it is pinned to the bottom of the viewport: the button that
   * finishes the job should be under the thumb, not somewhere down the page. On
   * a desktop it sits in the flow, because there is no reach problem to solve
   * and a floating bar over a short page looks like a cookie notice.
   */
  .ip-composer {
    position: sticky;
    /*
     * Above the analytics consent banner when there is one. src/consent.js
     * publishes its measured height as --pm-consent-height and removes the
     * property when the banner goes; the fallback of 0 is the normal case.
     */
    bottom: var(--pm-consent-height, 0px);
    z-index: 20;
    margin-inline: calc(-1 * var(--proof-pad));
    padding: var(--proof-space-3) var(--proof-pad)
             calc(var(--proof-space-3) + env(safe-area-inset-bottom, 0px));
    background: var(--proof-surface);
    border-top: 1px solid var(--proof-border);
    box-shadow: 0 -8px 24px -18px rgba(16, 24, 40, 0.5);
  }
  /* Keeps the last of the page clear of the pinned bar. */
  .ip-composer-spacer { height: var(--proof-space-6); }

  .ip-composer-state { font-size: 0.82rem; margin-bottom: var(--proof-space-2); }
  .ip-composer-file { color: var(--proof-ink-soft); }
  .ip-composer-file strong { font-weight: 500; }

  .ip-composer-row { display: flex; align-items: center; gap: var(--proof-space-2); }
  /* The design name gives up its space first — the icons and the action button
     are the parts that must never shrink. */
  .ip-composer-design {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.82rem;
    color: var(--proof-muted);
  }
  /* Its own line at the foot of the bar, at the regular size. */
  .ip-composer-go { display: flex; width: max-content; margin-top: var(--proof-space-3); }

  .ip-icon-btn {
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    background: transparent;
    border: 1px solid var(--proof-border);
    border-radius: 999px;
    color: var(--proof-ink);
    cursor: pointer;
  }
  /* The round keys wear the same skin as every other button. */
  .ip-icon-btn { background: ${BUTTON.background}; border-color: ${BUTTON.border}; color: ${BUTTON.text}; }
  .ip-icon-btn:hover,
  .ip-icon-btn[aria-expanded="true"] {
    border-color: ${BUTTON.borderHover};
    box-shadow: ${BUTTON.shadowHover};
    color: ${BUTTON.textHover};
  }

  /* ── Popovers ── */

  .ip-pop { position: relative; display: inline-flex; }
  .ip-pop-panel {
    position: absolute;
    bottom: calc(100% + 8px);
    z-index: 30;
    min-width: 240px;
    max-width: min(320px, calc(100vw - 2 * var(--proof-pad)));
    padding: var(--proof-space-2);
    background: var(--proof-surface);
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-lg);
    box-shadow: 0 12px 32px -12px rgba(16, 24, 40, 0.32);
  }
  .ip-pop-panel[data-align="start"] { left: 0; }
  .ip-pop-panel[data-align="end"] { right: 0; }

  /*
   * On a phone the panel spans the composer instead of hanging off its trigger.
   *
   * Anchored to a 44px button two-thirds of the way along a 390px row, a 320px
   * panel runs off the right edge of the screen. Making .ip-pop static hands the
   * positioning to .ip-composer — which is sticky, so it is already a containing
   * block — and the panel then sits inside the same gutter as everything else.
   */
  @media (max-width: 599px) {
    .ip-composer .ip-pop { position: static; }
    .ip-composer .ip-pop-panel {
      left: var(--proof-pad);
      right: var(--proof-pad);
      max-width: none;
    }
  }

  .ip-menu { display: grid; }
  .ip-menu-item {
    display: flex;
    align-items: center;
    gap: var(--proof-space-3);
    width: 100%;
    min-height: 44px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--proof-radius);
    background: transparent;
    font: inherit;
    font-size: 0.92rem;
    color: var(--proof-ink);
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }
  .ip-menu-item:hover { background: rgba(17, 20, 24, 0.05); }
  .ip-menu-item svg { flex: 0 0 auto; color: var(--proof-muted); }

  /* ── Design previews ── */

  .ip-shots { display: grid; gap: var(--proof-space-4); margin-top: var(--proof-space-4); }
  .ip-shot { margin: 0; }
  /*
   * The exports are 5.5 x 8.5 artwork on white. A border rather than a shadow,
   * because the artwork already has its own white ground and a shadow would
   * make the page edge look like a card edge.
   */
  .ip-shot img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius);
    background: #fff;
  }
  .ip-shot figcaption {
    margin-top: 6px;
    font-size: 0.78rem;
    color: var(--proof-muted);
  }

  /* ── Colour panel ── */

  .ip-colors { display: grid; gap: var(--proof-space-3); padding: var(--proof-space-2); }
  .ip-color-row { display: grid; gap: 6px; }
  .ip-color-label { font-size: 0.78rem; font-weight: 500; color: var(--proof-ink); }
  .ip-color-hint { display: block; font-weight: 400; color: var(--proof-muted); }
  /*
   * Six controls and a preview do not fit above a composer on a phone. The panel
   * takes what the viewport allows and scrolls inside itself, rather than
   * running off the top of the screen where the first control would be
   * unreachable.
   */
  .ip-pop-panel { max-height: min(62vh, 520px); overflow-y: auto; overscroll-behavior: contain; }
  .ip-color-inputs { display: flex; align-items: center; gap: var(--proof-space-2); }
  /* The picker is the swatch: strip the platform chrome so the colour itself is
     the whole control. */
  .ip-color-input {
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    padding: 0;
    border: 1px solid var(--proof-border-strong);
    border-radius: var(--proof-radius);
    background: none;
    cursor: pointer;
  }
  .ip-color-input::-webkit-color-swatch-wrapper { padding: 3px; }
  .ip-color-input::-webkit-color-swatch { border: 0; border-radius: 3px; }
  .ip-hex {
    flex: 1 1 auto;
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.9rem;
    text-transform: uppercase;
    min-height: 44px;
    padding: 0 10px;
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius);
    background: var(--proof-surface);
    color: var(--proof-ink);
  }
  .ip-hex[aria-invalid="true"] { border-color: var(--proof-danger); }
  .ip-link-btn {
    flex: 0 0 auto;
    background: none;
    border: 0;
    padding: 0 4px;
    min-height: 44px;
    font: inherit;
    font-size: 0.82rem;
    color: var(--proof-muted);
    text-decoration: underline;
    cursor: pointer;
  }
  .ip-link-btn:disabled { color: var(--proof-border-strong); text-decoration: none; cursor: default; }

  /* ── Expandable help ── */

  .ip-details {
    margin-top: var(--proof-space-5);
    border-top: 1px solid var(--proof-border);
    padding-top: var(--proof-space-2);
  }
  .ip-details > summary {
    /* A 44px row, and a pointer cursor, because a <summary> is a control even
       though nothing about its default styling says so. */
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--proof-ink);
    list-style: none;
  }
  .ip-details > summary::-webkit-details-marker { display: none; }
  .ip-details > summary::before {
    content: "+";
    display: inline-block;
    width: 1.1em;
    font-weight: 400;
    color: var(--proof-muted);
  }
  .ip-details[open] > summary::before { content: "–"; }
  .ip-details .ip-prose { font-size: 0.9rem; padding-bottom: var(--proof-space-2); }

  /* ── Consent ── */

  .ip-consent {
    display: flex;
    gap: var(--proof-space-3);
    align-items: flex-start;
    margin-top: var(--proof-space-3);
    font-size: 0.85rem;
    line-height: 1.45;
    color: var(--proof-ink-soft);
    cursor: pointer;
  }
  /* 20px, not the 13px default. This is the control that gates the whole flow
     and it has to be hittable with a thumb. */
  .ip-consent input {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    margin: 1px 0 0;
    accent-color: var(--proof-ink);
  }

  /* Disabled, for every variant rather than just the primary one. The create
     button is the one that submits, so it is the one that spends time
     disabled. */
  .ip-btn:disabled,
  .ip-btn[aria-disabled="true"] {
    background: ${BUTTON.background};
    border-color: ${BUTTON.border};
    box-shadow: none;
    color: ${BUTTON.textDisabled};
    cursor: not-allowed;
  }

  /* ── Links and focus ── */

  /*
   * Buttons are excluded by class rather than by element, because half of them
   * are anchors — a download and a "create a proof" link both need to look like
   * the button they behave as.
   */
  /*
   * :where() on purpose. This is the DEFAULT look of a link, and a default must
   * lose to any component that styles its own — .ip-workspace a:not():not()
   * weighs 0-3-1, which beat every such rule and underlined every word inside
   * the Data Merge section's whole-card links. Inside :where() it weighs 0-1-0,
   * so a single class wins, and ordinary prose links are unchanged.
   */
  .ip-workspace :where(a:not(.ip-btn):not(.ip-menu-item)) {
    color: var(--proof-ink);
    text-decoration: underline;
    text-decoration-color: var(--proof-accent);
    text-underline-offset: 2px;
  }
  .ip-workspace :where(a:not(.ip-btn):not(.ip-menu-item)):hover { color: var(--proof-accent-deep); }
  .ip-card-title a { text-decoration: none; }
  .ip-card-title a:hover { text-decoration: underline; }

  /*
   * One focus ring for the whole shell.
   *
   * :focus-visible rather than :focus, so it appears for a keyboard user and not
   * for someone who has just tapped the colour mark. Several controls here are
   * custom — the icon buttons, the design rows, the summary — and none of them
   * carries a default ring worth keeping.
   */
  .ip-app :focus-visible {
    outline: 2px solid var(--proof-focus);
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* ── Content pages ── */

  .ip-prose { max-width: 68ch; }
  .ip-prose h2 { font-size: 1.25rem; margin: var(--proof-space-6) 0 var(--proof-space-2); color: var(--proof-ink); }
  .ip-prose p { margin: 0 0 var(--proof-space-3); line-height: 1.65; }
  .ip-prose ul, .ip-prose ol { margin: 0 0 var(--proof-space-4); padding-left: 1.25rem; line-height: 1.65; }
  .ip-prose li { margin-bottom: 6px; }
  .ip-list-plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--proof-space-3); }

  /* ── Forms ── */

  .ip-field { margin: 0 0 var(--proof-space-4); display: grid; gap: 6px; }
  .ip-field label { font-size: 0.85rem; font-weight: 500; color: var(--proof-ink); }
  .ip-field input,
  .ip-field select,
  .ip-field textarea {
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    font: inherit;
    font-size: 16px; /* iOS zooms the page on focus at anything smaller. */
    color: var(--proof-ink);
    background: var(--proof-surface);
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius);
  }
  .ip-field textarea { resize: vertical; line-height: 1.5; }
  .ip-field input:focus-visible,
  .ip-field select:focus-visible,
  .ip-field textarea:focus-visible { outline: 2px solid var(--proof-focus); outline-offset: 1px; }
  .ip-field-grid { display: grid; gap: 0 var(--proof-space-4); }
  /* Off-screen rather than display:none — a bot reading the DOM should find it
     as a normal field, which is the entire point of a honeypot. */
  .ip-honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }

  /* ── Tables ── */

  .ip-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 30rem; }
  .ip-table th, .ip-table td { text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--proof-border); }
  .ip-table thead th {
    font-size: 0.74rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--proof-muted);
    font-weight: 500;
  }
  .ip-table tbody th { font-weight: 500; color: var(--proof-ink); }

  /* ── Motion ── */

  @media (prefers-reduced-motion: reduce) {
    .ip-sidebar { transition: none; }
    /* The screen stays — a launch screen is not motion — but nothing on it
       moves, and it leaves sooner. */
    .ip-boot-fill { animation: none; width: 100%; }
    .ip-boot img, .ip-boot p { animation: none; }
    .ip-boot::before { animation: none; }
    .ip-boot { animation-delay: 0.35s; }
  }

  /* ── Desktop ── */

  @media (min-width: 900px) {
    .ip-topbar { display: none; }
    .ip-scrim { display: none; }
    .ip-app {
      display: grid;
      grid-template-columns: var(--proof-sidebar-w) minmax(0, 1fr);
      align-items: start;
    }
    .ip-sidebar {
      position: sticky;
      top: 0;
      height: 100svh;
      width: auto;
      transform: none;
      /* Part of the page again, whatever the drawer state was left at. */
      visibility: visible;
      z-index: 1;
    }
    .ip-workspace { padding-top: var(--proof-space-7); }
    .ip-designs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* In the flow rather than pinned: there is no thumb-reach problem on a
       desktop, and a floating bar over a short page reads as a notice. */
    .ip-composer { position: static; margin-inline: 0; border: 1px solid var(--proof-border); border-radius: var(--proof-radius-lg); box-shadow: var(--proof-shadow); padding: var(--proof-space-4); }
    .ip-composer-spacer { display: none; }
    .ip-field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    /* Two 2:1 exports side by side still read at a desktop's width. */
    .ip-shots { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  }
`;
