/*
 * Twilio, over its REST API. No SDK: two calls do not justify a dependency.
 *
 * SERVER ONLY. Never import from src/.
 *
 * Under the test suite nothing leaves the process — messages are collected in
 * `outbox` so the tests can read exactly what the studio would have received.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const outbox = [];

const testing = () => process.env.NODE_ENV === "test";

/** Send one text from the site's Twilio number. */
export async function sendSms(to, body) {
  if (testing()) {
    outbox.push({ to, body });
    return;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER, Body: body }),
  });
  if (!response.ok) {
    /* Status only. Twilio's error body can echo the destination number. */
    throw new Error(`Twilio send failed with status ${response.status}.`);
  }
}

/*
 * Whether a webhook request really came from Twilio.
 *
 * Twilio signs the exact URL it called plus every POST parameter, sorted by
 * name and concatenated as name+value, with HMAC-SHA1 under the account's auth
 * token. Without this check anyone who found the webhook URL could post
 * "replies" into a visitor's chat.
 */
export function validTwilioSignature({ url, params, signature, authToken = process.env.TWILIO_AUTH_TOKEN }) {
  if (!signature || !authToken) return false;
  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");
  const expected = createHmac("sha1", authToken).update(payload).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const emptyTwiml = (message = "") =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${escapeXml(message)}</Message>` : ""}</Response>`,
    { headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" } }
  );

const escapeXml = (value) =>
  String(value).replace(/[<>&'"]/g, (character) => `&#${character.charCodeAt(0)};`);
