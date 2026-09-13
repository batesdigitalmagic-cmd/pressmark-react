/*
 * The first-visit loading screen.
 *
 * ── What it is, and what it is not ──
 *
 * It is a brief, deliberate handover from "a link was clicked" to "you are in
 * the workspace". It is NOT a loader: the tool behind it is already mounted and
 * interactive, so nothing is being waited for and nobody is being made to wait
 * for us. That is why it is an overlay over a finished page rather than a gate
 * in front of an unfinished one — the markup a crawler reads is the tool,
 * present in the DOM from the first render.
 *
 * ── Once per session, not once per navigation ──
 *
 * sessionStorage, so it plays once and then never again while the visitor moves
 * around the site in that tab. localStorage would suppress it for months on a
 * machine that has seen it once, which is a different promise than the one
 * being made here; a plain flag in module scope would replay it on every page.
 *
 * ── Timing ──
 *
 * The fade is a CSS animation with a delay, so the whole thing is over in
 * 1.2 seconds without a timer that can drift or be starved by React work. The
 * element is then removed from the DOM by the one timeout below, because an
 * invisible fixed overlay left in place still swallows the first click.
 *
 * Reduced motion shortens the hold and stills the progress bar (see SHELL_CSS);
 * it does not remove the screen, because the screen itself is not motion.
 */

import { useEffect, useState } from "react";

/*
 * The light cut, because the launch screen is ink.
 *
 * Only the wordmark differs between the two files: on the standard lockup it is
 * near-black and would vanish here. The file, the arrow and the pink are
 * identical in both.
 */
import logo from "../../assets/pressmark-studio-logo-light.svg";

const SEEN_KEY = "pressmark.boot.seen";

/* Must outlast the CSS animation-delay plus its duration (0.78s + 0.42s). */
const REMOVE_AFTER_MS = 1200;
const REMOVE_AFTER_REDUCED_MS = 600;

/** Storage throws in some privacy modes; a boot screen is not worth an error. */
function alreadySeen() {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* Not remembering means it plays again next page. That is the harmless
       failure, so there is nothing to handle. */
  }
}

export default function BootScreen() {
  /*
   * Decided during the first render, not in an effect: deciding later would
   * paint the workspace and then drop a splash on top of it, which is the exact
   * flash this is supposed to avoid.
   */
  const [visible, setVisible] = useState(() => !alreadySeen());

  useEffect(() => {
    if (!visible) return undefined;
    remember();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => setVisible(false),
      reduced ? REMOVE_AFTER_REDUCED_MS : REMOVE_AFTER_MS
    );
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    /*
     * aria-hidden: a screen-reader user is already being read the workspace
     * underneath, and announcing a decorative splash would interrupt that with
     * something they cannot act on and that will be gone before they reach it.
     */
    <div className="ip-boot" aria-hidden="true">
      <img src={logo} alt="" />
      <p>Preparing your publication workspace</p>
      <span className="ip-boot-track">
        <span className="ip-boot-fill" />
      </span>
    </div>
  );
}
