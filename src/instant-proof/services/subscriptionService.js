/*
 * Email-updates subscription.
 *
 * ── The state of this ──
 *
 * THERE IS NO SUBSCRIPTION BACKEND IN THIS REPOSITORY. `api/` carries quote.js
 * (a Zoho CRM lead), checkout, download, health, licence, portal and webhooks.
 * Nothing writes to a mailing list.
 *
 * So this ships as an interface plus an implementation that reports itself
 * UNCONFIGURED and fails honestly. It does not invent credentials, does not
 * post to a guessed endpoint, and — the part that matters — never tells a
 * visitor they were subscribed when nothing happened. A silent failure here
 * means someone waits for an email that will never arrive.
 *
 * ── Consent ──
 *
 * Subscription is a separate, affirmative act. Generating a proof is not
 * consent. Requesting a quote is not consent. A quote email must never be added
 * to a list without the visitor separately choosing it. That rule lives in the
 * UI (EmailUpdatesOptIn.jsx) and in this module's contract: the only way to
 * subscribe anyone is to call subscribe() with an email the visitor typed into
 * the subscription control itself.
 *
 * ── What Phase 3 needs ──
 *
 * Build `POST /api/subscribe` accepting `{ email, source }`, and:
 *
 *   1. Hold the provider credential server-side only. eslint.config.js already
 *      forbids src/ importing lib/ or api/ for exactly this reason.
 *   2. Rate-limit it — lib/rate-limit.js exists. An unauthenticated endpoint
 *      that sends mail is otherwise an open relay for abuse.
 *   3. Use double opt-in. Record the confirmation timestamp and the source.
 *   4. Honour unsubscribe, and expose a link in every message.
 *   5. Return { ok: true } only once the provider has accepted the address.
 *
 * Then set isConfigured to true and point subscribe() at it. No UI changes.
 */

/**
 * @typedef {object} SubscriptionResult
 * @property {boolean} ok
 * @property {string} message      Shown to the visitor verbatim.
 */

/**
 * @typedef {object} SubscriptionService
 * @property {boolean} isConfigured  False while no backend exists.
 * @property {(email: string, source: string) => Promise<SubscriptionResult>} subscribe
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value) => EMAIL_PATTERN.test(String(value ?? "").trim());

/* Where a visitor can be added by hand until the endpoint exists. */
export const SUBSCRIBE_FALLBACK_ADDRESS = "hello@pressmark.studio";

/** @returns {SubscriptionService} */
export function createSubscriptionService() {
  return {
    isConfigured: false,

    async subscribe(email) {
      if (!isValidEmail(email)) {
        return { ok: false, message: "Enter a valid email address." };
      }

      /*
       * Deliberately not a network call. There is no endpoint, and posting
       * hopefully at a URL that does not exist would produce a 404 the UI would
       * have to interpret — with a real risk of one day reading an unrelated
       * 200 as success.
       */
      return {
        ok: false,
        message:
          "Our mailing list isn't connected yet, so we have not subscribed you — we won't pretend otherwise. " +
          `Email ${SUBSCRIBE_FALLBACK_ADDRESS} and we'll add you by hand.`,
      };
    },
  };
}

/** The service this build uses. One place to swap when the endpoint lands. */
export const getSubscriptionService = () => createSubscriptionService();
