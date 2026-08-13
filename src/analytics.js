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
   dataLayer must not exist at all before consent. */
function gtag(...args) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

let started = false;
let loaded = false;

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
  if (loaded || !MEASUREMENT_ID) return false;
  loaded = true;

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
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, {
    // Scrubbed URL — this is what stops session ids reaching Google.
    page_location: safeLocation(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  // Anything queued while awaiting a decision — chiefly a purchase on
  // /success — is sent now that consent exists.
  while (pending.length) gtag(...pending.shift());

  return true;
}

export function initAnalytics() {
  if (started || !MEASUREMENT_ID) return false;
  if (typeof window === "undefined" || isExcludedPath()) return false;
  started = true;

  const stored = readConsent();

  if (stored === CONSENT_GRANTED) {
    loadAnalytics();
    return true;
  }

  // Declined: never load, never ask again.
  if (stored === CONSENT_DENIED) return false;

  mountConsentBanner((choice) => {
    if (choice === CONSENT_GRANTED) loadAnalytics();
    else pending.length = 0;
  });

  return true;
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
