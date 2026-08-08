/*
 * Stripe webhook: issues keys on payment, revokes on refund and chargeback.
 * Handles live and sandbox events on one URL.
 *
 * ── How the mode is decided ──
 *
 * By signature, not by anything in the payload. Stripe signs with the secret
 * belonging to the endpoint that sent the event, so verification is itself the
 * discriminator: the secret that validates identifies the account. A caller
 * cannot claim a mode, because it cannot produce a valid signature for one.
 *
 * Live is tried first so ordinary traffic verifies on the first attempt. Every
 * subsequent Stripe API call then uses that same mode's client — looking up a
 * test charge with a live key silently finds nothing.
 */

import {
  LIVE,
  TEST,
  getCryptoProvider,
  getStripe,
  isConfigured,
  webhookSecretFor,
} from "../../lib/stripe.js";
import { ensureLicense, revokeLicenseByOrder } from "../../lib/licenses.js";
import { logger, maskEmail } from "../../lib/log.js";

const log = logger("stripe-webhook");

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Stripe signs the raw body. Anything that parses it first breaks
  // verification — this read must stay ahead of everything else.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return json({ error: "No signature" }, 400);
  }

  const candidates = [LIVE, TEST].filter(
    (mode) => isConfigured(mode) && webhookSecretFor(mode)
  );

  if (candidates.length === 0) {
    log.error("no webhook secret configured for either mode");
    return json({ error: "Webhook not configured" }, 503);
  }

  let event = null;
  let mode = null;

  for (const candidate of candidates) {
    try {
      event = await getStripe(candidate).webhooks.constructEventAsync(
        body,
        signature,
        webhookSecretFor(candidate),
        undefined,
        getCryptoProvider()
      );
      mode = candidate;
      break;
    } catch {
      // Wrong secret for this event — try the next. Never log the failure
      // detail here; it echoes signature material.
    }
  }

  if (!event) {
    log.error("signature verification failed for all configured modes");
    return json({ error: "Invalid signature" }, 400);
  }

  /* Cross-check: the verifying secret and the event's own livemode flag must
     agree. A mismatch means secrets are crossed in configuration, and acting
     on it could write sandbox purchases into live records. */
  const expectedLivemode = mode === LIVE;
  if (typeof event.livemode === "boolean" && event.livemode !== expectedLivemode) {
    log.error("livemode mismatch; check which secret is set where", null, {
      verifiedAs: mode,
      eventLivemode: event.livemode,
    });
    return json({ error: "Mode mismatch" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Bank debits and other async methods settle later. Don't hand out a
        // key for money that hasn't arrived.
        if (session.payment_status !== "paid") {
          log.info("session not paid yet, waiting", { mode, session: session.id });
          break;
        }

        await issueFor(session, mode);
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        await issueFor(event.data.object, mode);
        break;
      }

      case "charge.refunded": {
        const orderId = await orderIdForCharge(event.data.object, mode);
        if (orderId) {
          const revoked = await revokeLicenseByOrder(orderId, "refund", mode);
          log.info("refund processed", { mode, order: orderId, revoked });
        }
        break;
      }

      case "charge.dispute.created": {
        const charge = await getStripe(mode).charges.retrieve(event.data.object.charge);
        const orderId = await orderIdForCharge(charge, mode);
        if (orderId) await revokeLicenseByOrder(orderId, "chargeback", mode);
        break;
      }
    }
  } catch (error) {
    // A 500 tells Stripe to retry, which is right when the store is briefly
    // down. ensureLicense is idempotent, so a retry cannot produce a second key.
    log.error("handler failed", error, { mode, event: event.type });
    return json({ error: "Handler failed" }, 500);
  }

  return json({ received: true, mode });
}

async function issueFor(session, mode) {
  const email = session.customer_details?.email || session.customer_email || null;

  const { created, license } = await ensureLicense({
    orderId: session.id,
    email,
    name: session.customer_details?.name ?? null,
    maxDevices: Number(session.metadata?.max_devices) || 2,
    updateMonths: Number(session.metadata?.update_months) || 12,
    livemode: mode === LIVE,
  });

  // Prefix only. The key is the customer's credential; logs are retained,
  // searchable, and readable by anyone with dashboard access.
  log.info("license issued", {
    mode,
    order: session.id,
    email: maskEmail(email),
    key: `${license.key.slice(0, 9)}…`,
    created,
  });
}

async function orderIdForCharge(charge, mode) {
  if (!charge.payment_intent) return null;
  const sessions = await getStripe(mode).checkout.sessions.list({
    payment_intent: charge.payment_intent,
    limit: 1,
  });
  return sessions.data[0]?.id ?? null;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
