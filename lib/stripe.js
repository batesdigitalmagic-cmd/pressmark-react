/*
 * Stripe clients and product configuration, for two isolated modes.
 *
 * SERVER ONLY. Never import from src/ — Vite inlines anything src/ touches
 * into the client bundle. The eslint boundary rule enforces it.
 *
 * ── Two modes, never mixed ──
 *
 *   "live" -> STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET
 *   "test" -> STRIPE_TEST_SECRET_KEY, STRIPE_TEST_PRICE_ID, STRIPE_TEST_WEBHOOK_SECRET
 *
 * Nothing reads across. The sandbox path asks for "test" and can only ever
 * receive test credentials; /buy asks for "live" and is untouched by any of
 * this.
 *
 * The sandbox additionally REFUSES to run unless its key carries the sk_test_
 * prefix. Pasting a live key into STRIPE_TEST_SECRET_KEY is the one mistake
 * that would let sandbox traffic charge real cards, so it is blocked at the
 * source rather than trusted to configuration discipline.
 *
 * Runs on Vercel's Edge runtime, hence the explicit fetch/SubtleCrypto wiring.
 */

import Stripe from "stripe";

export const LIVE = "live";
export const TEST = "test";

const CONFIG = {
  [LIVE]: {
    secretKey: (process.env.STRIPE_SECRET_KEY || "").trim(),
    priceId: (process.env.STRIPE_PRICE_ID || "").trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
  },
  [TEST]: {
    secretKey: (process.env.STRIPE_TEST_SECRET_KEY || "").trim(),
    priceId: (process.env.STRIPE_TEST_PRICE_ID || "").trim(),
    webhookSecret: (process.env.STRIPE_TEST_WEBHOOK_SECRET || "").trim(),
  },
};

const clients = {};

export function isConfigured(mode) {
  const config = CONFIG[mode];
  return Boolean(config?.secretKey && config?.priceId);
}

export function webhookSecretFor(mode) {
  return CONFIG[mode]?.webhookSecret || "";
}

export function priceIdFor(mode) {
  return CONFIG[mode]?.priceId || "";
}

/** True only for a real sk_test_ key. Used to gate the sandbox. */
export function isSandboxKeySafe() {
  return CONFIG[TEST].secretKey.startsWith("sk_test_");
}

/**
 * @param {"live"|"test"} mode
 * @throws {Error & {code: string}}
 */
export function getStripe(mode = LIVE) {
  const config = CONFIG[mode];

  if (!config?.secretKey) {
    const error = new Error(
      mode === TEST
        ? "Sandbox is not configured. Set STRIPE_TEST_SECRET_KEY and STRIPE_TEST_PRICE_ID."
        : "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID."
    );
    error.code = "stripe_not_configured";
    throw error;
  }

  // Hard stop: the sandbox must never hold a live key.
  if (mode === TEST && !config.secretKey.startsWith("sk_test_")) {
    const error = new Error(
      "STRIPE_TEST_SECRET_KEY is not a test key. Sandbox checkout refuses to run with live credentials."
    );
    error.code = "sandbox_key_not_test";
    throw error;
  }

  if (!clients[mode]) {
    clients[mode] = new Stripe(config.secretKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return clients[mode];
}

/* Signature verification on Edge must use constructEventAsync with this
   provider; the synchronous version needs Node crypto and throws. */
let provider = null;
export function getCryptoProvider() {
  if (!provider) provider = Stripe.createSubtleCryptoProvider();
  return provider;
}

/* Back-compat for existing call sites that only ever mean live. */
export const stripeConfigured = isConfigured(LIVE);
export const stripeTestMode = CONFIG[LIVE].secretKey.startsWith("sk_test_");

/** What a customer is buying. Source of truth here, not in Stripe. */
export const PRODUCT = {
  name: "Pressmark BatchCutout",
  description: "Batch background removal for Adobe Photoshop",
  priceId: CONFIG[LIVE].priceId,
  maxDevices: 2,
  updateMonths: 12,
};
