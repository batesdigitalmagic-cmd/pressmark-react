/*
 * Sandbox checkout. Test credentials only.
 *
 * Separate from api/checkout.js on purpose. Sharing one endpoint and switching
 * on a parameter would mean a request could ask the live path for test
 * behaviour — or the reverse. This file cannot reach live credentials at all:
 * it passes TEST to every helper, and getStripe(TEST) refuses any key without
 * an sk_test_ prefix.
 *
 * Nothing here writes to /buy's flow, and /buy never reaches this file.
 */

import { PRODUCT, TEST, getStripe, isConfigured, isSandboxKeySafe, priceIdFor } from "../lib/stripe.js";
import { logger } from "../lib/log.js";

const log = logger("checkout-sandbox");

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isConfigured(TEST)) {
    log.error("sandbox not configured");
    return json(
      { error: "Sandbox is not configured. Set STRIPE_TEST_SECRET_KEY and STRIPE_TEST_PRICE_ID." },
      503
    );
  }

  if (!isSandboxKeySafe()) {
    // Refusing is the entire point — a live key here would charge real cards
    // from a page labelled "sandbox".
    log.error("STRIPE_TEST_SECRET_KEY is not an sk_test_ key; refusing");
    return json(
      { error: "Sandbox is misconfigured: STRIPE_TEST_SECRET_KEY must be a test key." },
      503
    );
  }

  try {
    const stripe = getStripe(TEST);
    const origin = request.headers.get("origin") || process.env.SITE_URL || "https://pressmark.studio";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceIdFor(TEST), quantity: 1 }],
      customer_creation: "always",
      automatic_tax: { enabled: process.env.STRIPE_TAX === "true" },
      allow_promotion_codes: true,

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/sandbox?cancelled=1`,

      metadata: {
        product: "batchcutout",
        max_devices: String(PRODUCT.maxDevices),
        update_months: String(PRODUCT.updateMonths),
        // Survives into the webhook and onto the license record.
        pressmark_mode: "sandbox",
      },
    });

    log.info("sandbox session created", { session: session.id });
    return json({ url: session.url });
  } catch (error) {
    log.error("sandbox session create failed", error);
    return json({ error: "Could not start sandbox checkout. Check the server logs." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
