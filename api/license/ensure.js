/*
 * The success page calls this with its session_id.
 *
 * It does the same work as the webhook, deliberately. Whichever arrives first
 * mints the key, so the customer sees it the instant the page loads instead of
 * watching a spinner wait on webhook delivery — and if the webhook never
 * arrives at all, the purchase still completes.
 */

import { getStripe, stripeConfigured } from "../../lib/stripe.js";
import { logger } from "../../lib/log.js";

const log = logger("license-ensure");
import { ensureLicense } from "../../lib/licenses.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!stripeConfigured) {
    return json({ error: "Licensing is not available right now. Please email support@pressmark.studio." }, 503);
  }

  try {
    const { session_id: sessionId } = await request.json().catch(() => ({}));

    if (!sessionId || typeof sessionId !== "string") {
      return json({ error: "Missing session_id" }, 400);
    }

    // Never trust a session id from the browser — ask Stripe whether it was
    // actually paid. Without this check anyone could mint keys by guessing.
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return json({ error: "This order has not been paid." }, 402);
    }

    const { license } = await ensureLicense({
      orderId: session.id,
      email: session.customer_details?.email ?? null,
      name: session.customer_details?.name ?? null,
      maxDevices: Number(session.metadata?.max_devices) || 2,
      updateMonths: Number(session.metadata?.update_months) || 12,
    });

    // Only the key and the address it went to. Never the whole record.
    return json({
      key: license.key,
      email: license.email,
      maxDevices: license.max_devices,
    });
  } catch (error) {
    log.error("ensure failed", error);
    return json({ error: "Could not retrieve your license. Please check your email." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
