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

const ACCENT = "#aa7d48";
const INK = "#020814";

function button(label, { primary }) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = label;
  Object.assign(el.style, {
    font: "inherit",
    fontSize: "0.72rem",
    fontWeight: "700",
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    whiteSpace: "nowrap",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.35)",
    background: primary ? ACCENT : "transparent",
    color: primary ? "#000" : "rgba(255,255,255,0.85)",
    transition: "background 0.2s, border-color 0.2s, color 0.2s",
  });
  el.addEventListener("mouseenter", () => {
    if (primary) el.style.background = "#96693a";
    else {
      el.style.borderColor = ACCENT;
      el.style.color = ACCENT;
    }
  });
  el.addEventListener("mouseleave", () => {
    if (primary) el.style.background = ACCENT;
    else {
      el.style.borderColor = "rgba(255,255,255,0.35)";
      el.style.color = "rgba(255,255,255,0.85)";
    }
  });
  return el;
}

/**
 * Shows the banner if no choice has been recorded.
 *
 * @param {(value: string) => void} onChoice called with "granted" or "denied"
 */
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
      borderTop: `2px solid ${ACCENT}`,
      color: "rgba(255,255,255,0.78)",
      fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
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
        color: ACCENT,
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
      onChoice(value);
    };

    const decline = button("Decline", { primary: false });
    decline.addEventListener("click", () => decide(CONSENT_DENIED));

    const accept = button("Accept", { primary: true });
    accept.addEventListener("click", () => decide(CONSENT_GRANTED));

    actions.append(decline, accept);
    inner.append(text, actions);
    bar.append(inner);
    document.body.appendChild(bar);

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
