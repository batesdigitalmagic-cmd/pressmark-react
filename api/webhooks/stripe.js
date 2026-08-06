/*
 * Stripe webhook: issues keys on payment, revokes on refund and chargeback.
 */

import { getCryptoProvider, getStripe, stripeConfigured } from "../../lib/stripe.js";
import { logger, maskEmail } from "../../lib/log.js";

const log = logger("stripe-webhook");
import { ensureLicense, revokeLicenseByOrder } from "../../lib/licenses.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!stripeConfigured || !process.env.STRIPE_WEBHOOK_SECRET) {
    log.error("not configured; cannot verify signature");
    return json({ error: "Webhook not configured" }, 503);
  }

  // Stripe signs the raw body. Anything that parses it first breaks
  // verification — this read must stay ahead of everything else.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return json({ error: "No signature" }, 400);
  }

  let event;
  try {
    // Async + SubtleCrypto: the synchronous constructEvent needs Node crypto
    // and throws on Edge.
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
      undefined,
      getCryptoProvider()
    );
  } catch (error) {
    log.error("signature verification failed", error);
    return json({ error: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Bank debits and other async methods settle later. Don't hand out a
        // key for money that hasn't arrived.
        if (session.payment_status !== "paid") {
          log.info("session not paid yet, waiting", { session: session.id });
          break;
        }

        await issueFor(session);
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        await issueFor(event.data.object);
        break;
      }

      case "charge.refunded": {
        const orderId = await orderIdForCharge(event.data.object);
        if (orderId) {
          const revoked = await revokeLicenseByOrder(orderId, "refund");
          log.info("refund processed", { order: orderId, revoked });
        }
        break;
      }

      case "charge.dispute.created": {
        const charge = await getStripe().charges.retrieve(event.data.object.charge);
        const orderId = await orderIdForCharge(charge);
        if (orderId) await revokeLicenseByOrder(orderId, "chargeback");
        break;
      }
    }
  } catch (error) {
    // A 500 tells Stripe to retry, which is right when the store is briefly
    // down. ensureLicense is idempotent, so a retry cannot produce a second key.
    log.error("handler failed", error, { event: event.type });
    return json({ error: "Handler failed" }, 500);
  }

  return json({ received: true });
}

async function issueFor(session) {
  const email = session.customer_details?.email || session.customer_email || null;

  const { created, license } = await ensureLicense({
    orderId: session.id,
    email,
    name: session.customer_details?.name ?? null,
    maxDevices: Number(session.metadata?.max_devices) || 2,
    updateMonths: Number(session.metadata?.update_months) || 12,
  });

  // Prefix only. The key is the customer's credential; logs are retained,
  // searchable, and readable by anyone with dashboard access.
  log.info("license issued", {
    order: session.id,
    email: maskEmail(email),
    key: `${license.key.slice(0, 9)}…`,
    created,
  });
}

async function orderIdForCharge(charge) {
  if (!charge.payment_intent) return null;
  const sessions = await getStripe().checkout.sessions.list({
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
