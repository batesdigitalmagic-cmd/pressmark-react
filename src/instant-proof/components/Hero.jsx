/*
 * The homepage hero — the one screen that has to say "this gives you your week
 * back" before anybody scrolls.
 *
 * ── Why a hero at all, on a page that is a tool ──
 *
 * The rest of this site is deliberately not a sales page: the tool is the
 * homepage and the customer is in it on the first paint. That is still true.
 * This is one screen above it, not a funnel — the tool is a single gesture
 * away, it is in the DOM from the first render, and the skip link jumps
 * straight past this to the composer.
 *
 * What it buys is context. A visitor who lands cold on a file picker does not
 * know what the file is for. The photograph answers that faster than a
 * paragraph can: this is the job being done by hand, and it is the job the tool
 * takes off your desk.
 *
 * ── The photograph is the argument ──
 *
 * It is the "before". Nothing in the copy has to describe the pile of proof
 * sheets because the picture is already showing it, so the words stay on the
 * one thing the picture cannot say: how long the new way takes.
 *
 * If the file is missing the hero still works. The image sits on top of a
 * gradient that carries the same tonal weight, and onError drops the element
 * entirely rather than leaving a browser's broken-image glyph in a hero. The
 * text never depends on the photo for contrast — the scrim is painted on the
 * section, not on the image.
 *
 * ── Motion ──
 *
 * A slow push in on the photograph and a staggered rise on the text. Both are
 * decoration over content that is already legible, which is the only reason
 * they are allowed to exist; prefers-reduced-motion stills the push and the
 * stagger in the global block in theme.css.js, and the still frame is composed
 * to be the one that reads.
 */

import { useCallback } from "react";

/*
 * Served from public/ rather than imported, because it is a photograph that
 * gets re-cropped and replaced without a rebuild, not an asset the bundle needs
 * to fingerprint.
 */
const PHOTO_SRC = "/media/directory-by-hand.jpg";

/* The anchor the button and the shell's skip link both aim at. */
export const TOOL_ANCHOR = "tool";

export default function Hero() {
  /*
   * Scrolled rather than left as a plain fragment jump so the landing is eased
   * rather than instant — the point of the gesture is that the customer sees
   * the tool arrive under the hero, not that the viewport teleports.
   *
   * The href stays a real fragment underneath: without JavaScript, or if this
   * throws, the anchor still works and still moves focus.
   */
  const toTool = useCallback((event) => {
    const target = document.getElementById(TOOL_ANCHOR);
    if (!target) return;
    event.preventDefault();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    /*
     * scrollIntoView moves the viewport, not the caret. Without this a keyboard
     * user presses the button and their focus is still up in the hero, so the
     * next Tab walks back through it.
     */
    target.focus({ preventScroll: true });
  }, []);

  return (
    <section className="ip-hero">
      <img
        className="ip-hero-photo"
        src={PHOTO_SRC}
        alt=""
        /* Decorative: the heading beside it already carries the meaning. */
        aria-hidden="true"
        /* The LCP element. Never lazy, and ahead of everything else. */
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onError={(event) => {
          /*
           * Say so. Removing the element is the right thing for a visitor —
           * the gradient underneath is composed and a broken-image glyph in a
           * hero is worse than no photograph — but it is silent, and a silent
           * fallback that looks deliberate is indistinguishable from a crop
           * that needs tuning. In dev, name the file that is missing.
           */
          if (import.meta.env?.DEV) {
            console.warn(
              `[hero] ${PHOTO_SRC} did not load, so the gradient fallback is showing. ` +
                `Put the photograph at public${PHOTO_SRC} — no other change is needed.`
            );
          }
          event.currentTarget.remove();
        }}
      />

      <div className="ip-hero-inner">
        <p className="ip-hero-eyebrow">Instant Publisher</p>

        <h1 className="ip-hero-title">
          Publisher designs used to take all week.
        </h1>

        <p className="ip-hero-lead">
          Now you can upload a spreadsheet, pick a design, and download the
          print-ready PDF in minutes — no layout software, no account, nothing to
          install.
        </p>

        <div className="ip-hero-actions">
          <a className="ip-btn ip-hero-cta" href={`#${TOOL_ANCHOR}`} onClick={toTool}>
            Create a book — free
          </a>
        </div>

        <ul className="ip-hero-points">
          <li>Minutes, not evenings</li>
          <li>Copy your spreadsheet to a template</li>
          <li>Print-ready PDF</li>
        </ul>
      </div>

      {/* Decorative: the button above says the same thing to a screen reader. */}
      <span className="ip-hero-cue" aria-hidden="true" />
    </section>
  );
}
