/*
 * Google Analytics 4 — strict, consent-gated loader.
 *
 * NO request reaches Google until the visitor clicks Accept. Not gtag.js, not
 * a cookieless ping, nothing. This is stricter than Google's own Consent Mode
 * pattern, which loads the library immediately with storage denied.
 *
 * The trade, stated plainly: visitors who decline are invisible in GA4, so
 * reported traffic will be lower than reality by the decline rate. That is
 * intended.
 *
 * Imported by the entry points that should be measured. Pages that must never
 * be measured simply do not import it, and this module refuses to run on their
 * paths anyway, so a future copy-paste can't quietly start tracking them.
 *
 * ── What this deliberately never sends ──
 *
 *   • Stripe session ids            (they identify an order and appear in /success URLs)
 *   • Licence keys                  (they are the customer's credential)
 *   • Email addresses or names      (personal data; GA4 forbids PII regardless)
 *   • Arbitrary query strings       (an allowlist is used instead of a denylist,
 *                                    so a parameter added later cannot leak by default)
 *
 * ── Excluded paths ──
 *
 * /portal, /sandbox, /sandbox-portal, /health. On these, gtag.js is never even
 * requested — no script tag, no network call to Google, no cookie. Exclusion by
 * omission rather than by filtering after the fact.
 */

/* Guarded so this module can be imported outside Vite (tests, node) without
   throwing on an undefined import.meta.env. */
const ENV = (typeof import.meta !== "undefined" && import.meta.env) || {};

import {
  CONSENT_DENIED,
  CONSENT_GRANTED,
  mountConsentBanner,
  readConsent,
  resetConsent,
} from "./consent.js";

const MEASUREMENT_ID = ENV.VITE_GA4_ID || "";

/* Prefix match: /portal also covers nothing else, /sandbox covers
   /sandbox-portal. */
const EXCLUDED_PREFIXES = ["/portal", "/sandbox", "/health"];

/* Campaign parameters are the only query strings ever forwarded. An allowlist
   means a future ?token= or ?session_id= is dropped without anyone
   remembering to add it to a blocklist. */
const CAMPAIGN_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "ref",
];

/* /success carries ?session_id=cs_live_… — strip everything there, campaign
   parameters included. Attribution is captured on the landing page anyway,
   which is where a visitor actually arrives from a campaign. */
const STRIP_ALL_PARAMS_PREFIXES = ["/success"];

export function isExcludedPath(pathname = window.location.pathname) {
  return EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}-`)
  );
}

/** origin + pathname, plus campaign params only where they are safe. */
export function safeLocation(url = window.location.href) {
  const parsed = new URL(url);
  const stripAll = STRIP_ALL_PARAMS_PREFIXES.some((p) => parsed.pathname.startsWith(p));

  const kept = new URLSearchParams();
  if (!stripAll) {
    for (const key of CAMPAIGN_PARAMS) {
      const value = parsed.searchParams.get(key);
      if (value) kept.set(key, value);
    }
  }

  const query = kept.toString();
  return `${parsed.origin}${parsed.pathname}${query ? `?${query}` : ""}`;
}

/* First page of the visit, remembered so a purchase can be attributed to the
   article that brought someone in. Path only — never a query string. */
const LANDING_KEY = "pm_landing_path";

function rememberLanding() {
  try {
    if (!sessionStorage.getItem(LANDING_KEY)) {
      sessionStorage.setItem(LANDING_KEY, window.location.pathname);
    }
  } catch {
    /* storage blocked — attribution degrades, nothing breaks */
  }
}

export function landingPath() {
  try {
    return sessionStorage.getItem(LANDING_KEY) || "(unknown)";
  } catch {
    return "(unknown)";
  }
}

/* Not exported: nothing outside this module may push to dataLayer, because
   dataLayer must not exist at all before consent.
 *
 * This MUST push `arguments`, never an array — and the difference is the whole
 * bug this function used to have.
 *
 * gtag.js walks dataLayer and only treats an array-LIKE `arguments` object as a
 * command. A genuine Array is read as a GTM-style variable push and silently
 * discarded. Written as `(...args) => dataLayer.push(args)`, gtag.js downloads
 * and runs perfectly while every js/config/event call is dropped on the floor —
 * which presents exactly as "GA4 is installed but Realtime shows zero".
 *
 * Do not "modernise" this to rest parameters. */
function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

/* ── TEMPORARY DIAGNOSTICS ──────────────────────────────────────────────────
   Flip DEBUG to false (or delete this block and every debug()/debugError()
   call) once GA4 Realtime is confirmed working. Logs carry no personal data —
   only the scrubbed URL that would be sent to Google anyway. */
const DEBUG = true;
const debug = (...args) => DEBUG && console.log("%c[GA4]", "color:#aa7d48", ...args);
const debugError = (...args) => DEBUG && console.error("[GA4]", ...args);

let started = false;
let loaded = false;
let routeListenerInstalled = false;
/* Path of the most recent page_view, so a route change cannot double-count the
   automatic page_view that `config` already sent. */
let lastTrackedPath = null;

/* Events raised before a decision. Held in memory only — never written to
   storage, never sent unless the visitor later accepts. Discarded on decline
   and on page unload, which is the correct outcome. */
const pending = [];

export const isAnalyticsLoaded = () => loaded;

/**
 * Injects gtag.js. The ONLY place a request to Google is made, and it is
 * unreachable unless consent has been granted.
 */
function loadAnalytics() {
  /* Single-load guard: the flag is set before the <script> is appended, so no
     re-entrant call can ever inject gtag.js twice. */
  if (loaded) {
    debug("initialization skipped — gtag.js already loaded");
    return false;
  }
  if (!MEASUREMENT_ID) {
    debugError("initialization aborted — VITE_GA4_ID is empty at build time.");
    return false;
  }
  loaded = true;

  debug("initialization attempted for", MEASUREMENT_ID);

  // Written only now — storing a landing path beforehand would be analytics
  // storage without permission, however small.
  rememberLanding();

  /* Advertising signals stay denied permanently: this site runs no ads and has
     no remarketing. Accepting grants analytics only. */
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
    functionality_storage: "granted",
    security_storage: "granted",
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  script.addEventListener("load", () => debug("gtag.js loaded successfully"));
  script.addEventListener("error", () =>
    debugError(
      "gtag.js FAILED to load — almost always an ad blocker, a privacy extension, " +
        "or a network filter. Commands stay queued in dataLayer and never reach Google."
    )
  );
  document.head.appendChild(script);

  const location = safeLocation();

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, {
    // Scrubbed URL — this is what stops session ids reaching Google.
    page_location: location,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  /* `config` sends the first page_view by itself, so no manual page_view is
     fired here — doing both would double-count the landing page. Subsequent
     in-app navigations are sent manually by trackPageView(). */
  lastTrackedPath = window.location.pathname;
  debug("initial page_view sent:", location);

  // Anything queued while awaiting a decision — chiefly a purchase on
  // /success — is sent now that consent exists.
  while (pending.length) gtag(...pending.shift());

  installRouteListener();

  return true;
}

/**
 * Sends a page_view for a client-side navigation.
 *
 * Exported so a router can call it directly. Returns false before consent —
 * page views are never queued, because a view that happened before permission
 * is not one we are entitled to report later.
 */
export function trackPageView(url = window.location.href) {
  if (!loaded) return false;

  const parsed = new URL(url);
  if (isExcludedPath(parsed.pathname)) {
    debug("route page_view suppressed — excluded path:", parsed.pathname);
    return false;
  }

  const location = safeLocation(url);
  lastTrackedPath = parsed.pathname;

  gtag("event", "page_view", {
    page_location: location,
    page_path: parsed.pathname,
    page_title: document.title,
  });

  debug("route page_view sent:", location);
  return true;
}

/**
 * Reports page views for client-side route changes.
 *
 * This site is currently multi-page — each link is a real document load that
 * runs initAnalytics() and sends its own page_view — so this listener is inert
 * today. It exists so that adding a client-side router later cannot silently
 * stop page views being reported, which is a failure nobody notices for weeks.
 *
 * Only pathname changes count. Hash changes are in-page anchors, not views.
 */
function installRouteListener() {
  if (routeListenerInstalled || typeof window === "undefined") return;
  routeListenerInstalled = true;

  const onNavigate = () => {
    try {
      if (window.location.pathname === lastTrackedPath) return;
      trackPageView();
    } catch (error) {
      debugError("route page_view failed:", error);
    }
  };

  /* pushState/replaceState fire no event of their own, so they are wrapped.
     The original return value is preserved for any caller that reads it. */
  for (const method of ["pushState", "replaceState"]) {
    const original = window.history[method];
    if (typeof original !== "function") continue;
    window.history[method] = function patched(...args) {
      const result = original.apply(this, args);
      onNavigate();
      return result;
    };
  }

  window.addEventListener("popstate", onNavigate);
  debug("route listener installed");
}

export function initAnalytics() {
  try {
    if (started) {
      debug("init skipped — already initialised for this document");
      return false;
    }
    if (!MEASUREMENT_ID) {
      debugError(
        "init aborted — VITE_GA4_ID was empty when this bundle was built. " +
          "VITE_* variables are inlined at BUILD time, so setting it in Vercel " +
          "requires a redeploy to take effect."
      );
      return false;
    }
    if (typeof window === "undefined") return false;
    if (isExcludedPath()) {
      debug("init skipped — excluded path:", window.location.pathname);
      return false;
    }
    started = true;

    const stored = readConsent();
    debug("consent status detected:", stored ?? "undecided (banner will show)");

    if (stored === CONSENT_GRANTED) {
      // Returning visitor who already accepted — load immediately, no banner.
      loadAnalytics();
      return true;
    }

    // Declined: never load, never ask again.
    if (stored === CONSENT_DENIED) {
      debug("consent previously denied — gtag.js will not be requested");
      return false;
    }

    mountConsentBanner((choice) => {
      try {
        debug("consent choice made:", choice);
        if (choice === CONSENT_GRANTED) loadAnalytics();
        else pending.length = 0;
      } catch (error) {
        debugError("failed to initialise after consent:", error);
      }
    });

    return true;
  } catch (error) {
    debugError("initialisation error:", error);
    return false;
  }
}

/** Clears the stored choice so the banner shows again on next load. */
export function revokeAnalyticsConsent() {
  resetConsent();
}

/**
 * Fires the GA4 purchase event.
 *
 * `order` comes from /api/license/ensure and contains only non-identifying
 * commercial fields: a hashed transaction reference, the amount, the currency,
 * and the product name. The licence key and email returned alongside it on the
 * success page are never passed in here.
 */
export function trackPurchase(order) {
  if (!MEASUREMENT_ID || isExcludedPath() || !order?.transactionId) return false;

  const event = [
    "event",
    "purchase",
    {
      transaction_id: order.transactionId,
      value: typeof order.value === "number" ? order.value : undefined,
      currency: order.currency || undefined,
      // Which article or entry point led here — the attribution question.
      landing_page: landingPath(),
      items: [
        {
          item_id: order.itemId || "batchcutout",
          item_name: order.item || "Pressmark BatchCutout",
          item_category: "Photoshop Automation",
          price: typeof order.value === "number" ? order.value : undefined,
          quantity: 1,
        },
      ],
    },
  ];

  /* Queued rather than dropped: someone who accepts on the success page still
     has their purchase recorded. Declining discards it unsent. */
  if (loaded) gtag(...event);
  else pending.push(event);

  return true;
}
