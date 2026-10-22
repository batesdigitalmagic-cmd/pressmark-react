/*
 * Creates a Stripe Checkout Session and hands back the redirect URL.
 * The buy buttons post here: /buy with no body (BatchCutout, as always),
 * /enhance-cutout with { product: "enhancecutout" }.
 */

import { LIVE, getStripe, isProductConfigured, priceIdFor } from "../lib/stripe.js";
import { getProduct, resolveProduct } from "../lib/products.js";
import { logger } from "../lib/log.js";

const log = logger("checkout");

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  /* The product comes from the page, but only as a choice between known ids.
     Price, seats and update period are all looked up here, never taken from
     the request. */
  const body = await request.json().catch(() => ({}));
  const productId = resolveProduct(body.product ?? new URL(request.url).searchParams.get("product"));
  if (!productId) {
    return json({ error: "Unknown product." }, 400);
  }
  const PRODUCT = getProduct(productId);
  const priceId = priceIdFor(LIVE, productId);

  if (!isProductConfigured(LIVE, productId)) {
    log.error("not configured", null, { product: productId, hasPrice: Boolean(priceId) });
    return json({ error: "Checkout is not available right now. Please email support@pressmark.studio." }, 503);
  }

  try {
    const stripe = getStripe();
    const origin = request.headers.get("origin") || process.env.SITE_URL || "https://pressmark.studio";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],

      // Stripe collects and verifies the email. It becomes the address the
      // license is tied to and the one recovery answers to, so it has to be
      // collected rather than optional.
      customer_creation: "always",

      // Lets Stripe Tax be switched on later without touching this code.
      automatic_tax: { enabled: process.env.STRIPE_TAX === "true" },

      allow_promotion_codes: true,

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&product=${productId}`,
      cancel_url: `${origin}${PRODUCT.page}?cancelled=1`,

      metadata: {
        product: productId,
        max_devices: String(PRODUCT.maxDevices),
        update_months: String(PRODUCT.updateMonths),
      },
    });

    return json({ url: session.url });
  } catch (error) {
    log.error("session create failed", error);
    return json({ error: "Could not start checkout. Please try again." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
