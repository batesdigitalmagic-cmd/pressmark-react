/*
 * Creates a Stripe Checkout Session and hands back the redirect URL.
 * The buy button posts here.
 */

import { PRODUCT, getStripe, stripeConfigured } from "../lib/stripe.js";
import { logger } from "../lib/log.js";

const log = logger("checkout");

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!stripeConfigured || !PRODUCT.priceId) {
    log.error("not configured", null, { hasKey: stripeConfigured, hasPrice: Boolean(PRODUCT.priceId) });
    return json({ error: "Checkout is not available right now. Please email support@pressmark.studio." }, 503);
  }

  try {
    const stripe = getStripe();
    const origin = request.headers.get("origin") || process.env.SITE_URL || "https://pressmark.studio";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: PRODUCT.priceId, quantity: 1 }],

      // Stripe collects and verifies the email. It becomes the address the
      // license is tied to and the one recovery answers to, so it has to be
      // collected rather than optional.
      customer_creation: "always",

      // Lets Stripe Tax be switched on later without touching this code.
      automatic_tax: { enabled: process.env.STRIPE_TAX === "true" },

      allow_promotion_codes: true,

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/buy?cancelled=1`,

      metadata: {
        product: "batchcutout",
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
