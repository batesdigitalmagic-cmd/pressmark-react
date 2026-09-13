/*
 * Analytics consent banner.
 *
 * Built with plain DOM rather than React so it lives entirely inside the
 * analytics module: one implementation covers every measured page, and no page
 * component has to remember to render it. It also means the banner is
 * independent of React mounting, so a slow or failed hydration can't leave a
 * visitor tracked without having chosen.
 *
 * ── How consent actually works here ──
 *
 * Nothing is loaded before a decision. gtag.js is not requested, dataLayer is
 * not created, and no cookie is set. Accepting loads GA4 for the first time;
 * declining means it is never loaded at all, on this visit or any future one.
 *
 * The choice is stored in localStorage so it survives across visits, and the
 * banner never reappears once a choice has been made.
 *
 * Never rendered on /portal, /sandbox, /sandbox-portal or /health — analytics
 * does not run there, so there is nothing to consent to.
 */

/* ── Privacy Policy link ────────────────────────────────────────────────
   Set VITE_PRIVACY_URL (e.g. "/privacy") once a policy page exists and the
   banner will link to it automatically. Left blank, no link renders — a
   consent banner pointing at a 404 is worse than one with no link.

   A privacy policy is expected under GDPR/ePrivacy. This is the hook. */
import { FONT_FAMILY } from "./fonts.js";
import { ACCENT, BUTTON } from "./palette.js";

const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};
const PRIVACY_URL = ENV.VITE_PRIVACY_URL || "";

const STORAGE_KEY = "pm_analytics_consent";

export const CONSENT_GRANTED = "granted";
export const CONSENT_DENIED = "denied";

export function readConsent() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === CONSENT_GRANTED || value === CONSENT_DENIED ? value : null;
  } catch {
    // Storage blocked (private mode, strict settings). Treat as undecided —
    // the banner shows each visit and consent stays denied unless accepted.
    return null;
  }
}

function storeConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* nothing to do — the in-page choice still applies for this pageview */
  }
}

/*
 * The banner is on navy, so its accent is the pink half of the InDesign pair —
 * maroon would not be readable against INK. Its buttons are the same Google
 * key as the rest of the site; a light grey key reads on navy as well as on
 * paper.
 */
const ACCENT_ON_INK = ACCENT.onDark;
const INK = "#020814";

function button(label) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  Object.assign(el.style, {
    font: "inherit",
    fontSize: BUTTON.fontSize,
    fontWeight: "400",
    minHeight: BUTTON.height,
    padding: `0 ${BUTTON.paddingX}`,
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: `1px solid ${BUTTON.border}`,
    borderRadius: BUTTON.radius,
    background: BUTTON.background,
    color: BUTTON.text,
    transition: "border-color 0.1s, box-shadow 0.1s, color 0.1s",
  });
  /* A banner that is usually dismissed by thumb gets the touch height. */
  if (window.matchMedia?.("(pointer: coarse)").matches) el.style.minHeight = BUTTON.touchHeight;
  el.addEventListener("mouseenter", () => {
    el.style.borderColor = BUTTON.borderHover;
    el.style.boxShadow = BUTTON.shadowHover;
    el.style.color = BUTTON.textHover;
  });
  el.addEventListener("mouseleave", () => {
    el.style.borderColor = BUTTON.border;
    el.style.boxShadow = "none";
    el.style.color = BUTTON.text;
  });
  return el;
}

/**
 * Shows the banner if no choice has been recorded.
 *
 * @param {(value: string) => void} onChoice called with "granted" or "denied"
 */
/* The banner's height, published for anything pinned to the bottom of the
   viewport. Zero when there is no banner, which is the normal state. */
const OFFSET_PROPERTY = "--pm-consent-height";
const setOffset = (px) =>
  document.documentElement.style.setProperty(OFFSET_PROPERTY, `${Math.round(px)}px`);
const clearOffset = () => document.documentElement.style.removeProperty(OFFSET_PROPERTY);

export function mountConsentBanner(onChoice) {
  if (typeof document === "undefined") return false;
  if (readConsent() !== null) return false;
  if (document.getElementById("pm-consent")) return false;

  const render = () => {
    const bar = document.createElement("div");
    bar.id = "pm-consent";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Analytics consent");
    Object.assign(bar.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      zIndex: "2147483000",
      background: INK,
      borderTop: `2px solid ${ACCENT_ON_INK}`,
      color: "rgba(255,255,255,0.78)",
      fontFamily: FONT_FAMILY,
      fontSize: "0.85rem",
      lineHeight: "1.6",
      padding: "1rem clamp(1.25rem, 5vw, 3rem)",
      boxShadow: "0 -8px 32px rgba(0,0,0,0.28)",
    });

    const inner = document.createElement("div");
    Object.assign(inner.style, {
      maxWidth: "1100px",
      margin: "0 auto",
      display: "flex",
      flexWrap: "wrap",
      gap: "0.9rem 1.5rem",
      alignItems: "center",
      justifyContent: "space-between",
    });

    const text = document.createElement("p");
    text.style.margin = "0";
    text.style.flex = "1 1 320px";
    text.append(
      document.createTextNode(
        "We use Google Analytics to understand which articles bring people here. " +
          "Nothing loads and nothing is stored unless you accept. "
      )
    );

    if (PRIVACY_URL) {
      const link = document.createElement("a");
      link.href = PRIVACY_URL;
      link.textContent = "Privacy Policy";
      Object.assign(link.style, {
        color: ACCENT_ON_INK,
        textDecoration: "underline",
        textUnderlineOffset: "3px",
      });
      text.append(link);
      text.append(document.createTextNode("."));
    }

    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", gap: "0.6rem", flexWrap: "wrap" });

    const decide = (value) => {
      storeConsent(value);
      bar.remove();
      clearOffset();
      onChoice(value);
    };

    const decline = button("Decline");
    decline.addEventListener("click", () => decide(CONSENT_DENIED));

    const accept = button("Accept");
    accept.addEventListener("click", () => decide(CONSENT_GRANTED));

    actions.append(decline, accept);
    inner.append(text, actions);
    bar.append(inner);
    document.body.appendChild(bar);

    /*
     * Tell the page how tall this is.
     *
     * The banner is fixed to the bottom of the viewport, which is exactly where
     * the proof tool pins its action bar — so on a first visit the button that
     * creates the proof sat underneath a cookie notice. Publishing the height as
     * a custom property lets anything anchored to the bottom lift itself clear,
     * and the two do not otherwise need to know about each other.
     *
     * Measured after it is in the document, because the text wraps to two lines
     * on a phone and one on a desktop.
     */
    setOffset(bar.offsetHeight);
    /* Re-measured on resize: a rotation changes how the text wraps. */
    const remeasure = () => setOffset(bar.offsetHeight);
    window.addEventListener("resize", remeasure);
    bar.addEventListener("pm-consent-gone", () => window.removeEventListener("resize", remeasure));

    // Keyboard users land on the banner without hunting for it.
    accept.focus({ preventScroll: true });
  };

  if (document.body) render();
  else document.addEventListener("DOMContentLoaded", render, { once: true });

  return true;
}

/** Lets a visitor change their mind — wire to a footer link if you add one. */
export function resetConsent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
