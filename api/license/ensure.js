/*
 * The success page calls this with its session_id.
 *
 * It does the same work as the webhook, deliberately. Whichever arrives first
 * mints the key, so the customer sees it the instant the page loads instead of
 * watching a spinner wait on webhook delivery — and if the webhook never
 * arrives at all, the purchase still completes.
 */

import { LIVE, TEST, getStripe, isConfigured } from "../../lib/stripe.js";
import { logger } from "../../lib/log.js";

const log = logger("license-ensure");
import { ensureLicense } from "../../lib/licenses.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isConfigured(LIVE) && !isConfigured(TEST)) {
    return json({ error: "Licensing is not available right now. Please email support@pressmark.studio." }, 503);
  }

  try {
    const { session_id: sessionId } = await request.json().catch(() => ({}));

    if (!sessionId || typeof sessionId !== "string") {
      return json({ error: "Missing session_id" }, 400);
    }

    /* Never trust a session id from the browser — ask Stripe whether it was
       actually paid. Without this check anyone could mint keys by guessing.

       The mode is discovered, not supplied: a live session id resolves only
       with the live key and a sandbox one only with the test key, so we ask
       live first and fall back. The browser never chooses which account is
       queried. */
    let session = null;
    let mode = LIVE;

    for (const candidate of [LIVE, TEST]) {
      if (!isConfigured(candidate)) continue;
      try {
        session = await getStripe(candidate).checkout.sessions.retrieve(sessionId);
        mode = candidate;
        break;
      } catch (error) {
        if (error?.code !== "resource_missing") throw error;
      }
    }

    if (!session) {
      return json({ error: "That order could not be found." }, 404);
    }

    if (session.payment_status !== "paid") {
      return json({ error: "This order has not been paid." }, 402);
    }

    const { license } = await ensureLicense({
      orderId: session.id,
      email: session.customer_details?.email ?? null,
      name: session.customer_details?.name ?? null,
      maxDevices: Number(session.metadata?.max_devices) || 2,
      updateMonths: Number(session.metadata?.update_months) || 12,
      livemode: mode === LIVE,
    });

    /* Commercial facts for analytics. Deliberately separate from the licence
       fields above so it is obvious what may be forwarded to a third party.

       transactionId is a SHA-256 prefix of the session id, not the session id
       itself: stable enough for GA4 to deduplicate a refreshed success page,
       but not reversible and not usable against the Stripe API. */
    const order = {
      transactionId: await hashOrderId(session.id),
      value: typeof session.amount_total === "number" ? session.amount_total / 100 : null,
      currency: (session.currency || "").toUpperCase() || null,
      item: "Pressmark BatchCutout",
      itemId: "batchcutout",
    };

    // Only the key and the address it went to. Never the whole record.
    return json({
      key: license.key,
      email: license.email,
      maxDevices: license.max_devices,
      livemode: license.livemode !== false,
      order,
    });
  } catch (error) {
    log.error("ensure failed", error);
    return json({ error: "Could not retrieve your license. Please check your email." }, 500);
  }
}

/* One-way, stable, and safe to hand to an analytics provider. */
async function hashOrderId(sessionId) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
