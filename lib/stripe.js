/*
 * Stripe client and product configuration.
 *
 * SERVER ONLY. Reads STRIPE_SECRET_KEY. Never import from src/ — Vite inlines
 * anything src/ touches into the client bundle. The eslint boundary rule turns
 * a bad import into a lint failure, this project's `import 'server-only'`.
 *
 * The client is built lazily. Constructing it at module scope means a missing
 * key throws during import, which surfaces as an opaque 500 with a stack trace
 * instead of a sentence explaining what to set — and takes down every route in
 * the file, including ones that don't need Stripe.
 *
 * Runs on Vercel's Edge runtime, where Stripe's default Node HTTP client and
 * crypto provider are unavailable — hence the explicit fetch/SubtleCrypto
 * wiring.
 */

import Stripe from "stripe";

const SECRET_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();

export const stripeConfigured = Boolean(SECRET_KEY);
export const stripeTestMode = SECRET_KEY.startsWith("sk_test_");

let client = null;

/** @throws {Error & {code: 'stripe_not_configured'}} */
export function getStripe() {
  if (!stripeConfigured) {
    const error = new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY (and STRIPE_PRICE_ID) in your environment."
    );
    error.code = "stripe_not_configured";
    throw error;
  }

  if (!client) {
    client = new Stripe(SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return client;
}

/* Signature verification on Edge must use constructEventAsync with this
   provider; the synchronous version needs Node crypto and throws. */
let provider = null;
export function getCryptoProvider() {
  if (!provider) provider = Stripe.createSubtleCryptoProvider();
  return provider;
}

/** What a customer is buying. Source of truth here, not in Stripe. */
export const PRODUCT = {
  name: "Pressmark BatchCutout",
  description: "Batch background removal for Adobe Photoshop",
  priceId: process.env.STRIPE_PRICE_ID || "",
  maxDevices: 2,
  updateMonths: 12,
};
