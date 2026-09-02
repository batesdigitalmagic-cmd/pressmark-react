/*
 * Reading a quote handoff left in sessionStorage.
 *
 * ── Why only a reader ──
 *
 * Instant Proof used to collect a contact name, email and phone during proof
 * creation and hand them to the marketing site's quote form. It no longer asks
 * for any of that: email is requested once, at the moment a visitor asks for a
 * reply, and that request posts straight to /api/quote from
 * services/contactRequests.js. So the WRITER has been removed.
 *
 * The reader stays because src/App.jsx calls it on every page load. It is
 * harmless with nothing to read, and it keeps the door open for any other
 * surface that wants to prefill that form. If a writer is ever added, note the
 * original reasoning: sessionStorage rather than query parameters, because a
 * name and email in a URL land in server logs, browser history and the
 * analytics referrer. Never localStorage, which would outlive the session.
 */

export const QUOTE_HANDOFF_KEY = "pressmark.quoteHandoff";

/**
 * Reads and clears the handoff. Returns null when there is nothing waiting.
 * Only the fields the quote form actually owns are returned, so a stale or
 * tampered payload cannot inject unexpected keys into its state.
 */
export function takeQuoteHandoff() {
  try {
    const raw = sessionStorage.getItem(QUOTE_HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(QUOTE_HANDOFF_KEY);

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const allowed = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "organization",
      "publicationType",
      "estimatedPageCount",
      "deadline",
      "projectDetails",
    ];
    const clean = {};
    for (const key of allowed) {
      if (typeof parsed[key] === "string" && parsed[key] !== "") clean[key] = parsed[key];
    }
    return Object.keys(clean).length > 0 ? clean : null;
  } catch {
    return null;
  }
}
