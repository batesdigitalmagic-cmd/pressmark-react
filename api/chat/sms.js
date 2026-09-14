/*
 * POST /api/chat/sms — Twilio's webhook for texts to the site's number.
 *
 * Set this URL as the "A message comes in" webhook on the Twilio number
 * (https://pressmark.studio/api/chat/sms, HTTP POST).
 *
 * Only two senders are acted on: requests Twilio actually signed, and texts
 * from the studio's own phone. A text from anyone else to the Twilio number is
 * ignored, so the number cannot be used to post into a visitor's chat.
 */

import { appendMessage, chatConfigured, normalizePhone, routeReply } from "../../lib/chat/chat.js";
import { emptyTwiml, validTwilioSignature } from "../../lib/chat/twilio.js";
import { json } from "../../lib/render-jobs/http.js";
import { toNodeHandler } from "../../lib/render-jobs/node-adapter.js";

/*
 * The URL Twilio signed. Behind Vercel the request can arrive with an internal
 * host or scheme, so the public address can be pinned with
 * PRESSMARK_CHAT_WEBHOOK_URL; otherwise it is rebuilt from the forwarded host.
 */
function signedUrl(request) {
  if (process.env.PRESSMARK_CHAT_WEBHOOK_URL) return process.env.PRESSMARK_CHAT_WEBHOOK_URL;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || url.host;
  return `https://${host}${url.pathname}${url.search}`;
}

/* Twilio posts a form. Vercel may already have parsed it, in which case the
   adapter hands the body on as JSON; both shapes are accepted. */
async function readParams(request) {
  const raw = await request.text();
  if (raw.trim().startsWith("{")) {
    try {
      return Object.fromEntries(Object.entries(JSON.parse(raw)).map(([k, v]) => [k, String(v)]));
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!chatConfigured()) return json({ error: "Chat is not configured." }, 503);

  try {
    const params = await readParams(request);
    const signature = request.headers.get("x-twilio-signature");
    if (!validTwilioSignature({ url: signedUrl(request), params, signature })) {
      return json({ error: "Invalid signature." }, 403);
    }

    if (normalizePhone(params.From) !== normalizePhone(process.env.PRESSMARK_CHAT_FORWARD_TO)) {
      return emptyTwiml();
    }

    const { conversation, text } = await routeReply(params.Body || "");
    if (!conversation) {
      return emptyTwiml("No open chat matched that reply. Start it with the 4-character chat code.");
    }
    if (!text) return emptyTwiml();

    await appendMessage(conversation, "studio", text);
    return emptyTwiml();
  } catch (error) {
    console.error("[chat] sms webhook failed:", error?.message || "unknown");
    return emptyTwiml();
  }
}

export default toNodeHandler(handler);
