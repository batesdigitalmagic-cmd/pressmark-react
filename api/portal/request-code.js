/*
 * Step 1 of portal sign-in: email a six-digit code to the purchase address.
 *
 * Anti-enumeration: the response is byte-identical whether or not that address
 * has ever bought anything. Otherwise this endpoint becomes a customer-list
 * oracle for anyone with a word list.
 */

import { getLicensesByEmail } from "../../lib/licenses.js";
import { saveSignInCode } from "../../lib/license-store.js";
import { generateCode, hashCode } from "../../lib/portal-session.js";
import { sendSignInCode } from "../../lib/email.js";
import { clientIp, rateLimit, tooManyRequests } from "../../lib/rate-limit.js";

export const config = { runtime: "edge" };

const CODE_TTL_SECONDS = 10 * 60;

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = clientIp(request);
  const byIp = await rateLimit("portal-request", ip, { limit: 5, windowSeconds: 900 });
  if (!byIp.ok) return tooManyRequests(byIp.resetSeconds);

  const { email } = await request.json().catch(() => ({}));
  const address = String(email || "").trim().toLowerCase();

  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return json({ error: "Enter the email address you used to buy BatchCutout." }, 400);
  }

  // A second bucket on the address itself, so one attacker rotating IPs still
  // can't mailbomb a single customer.
  const byEmail = await rateLimit("portal-request-email", address, {
    limit: 5,
    windowSeconds: 900,
  });
  if (!byEmail.ok) return tooManyRequests(byEmail.resetSeconds);

  try {
    const licenses = await getLicensesByEmail(address);

    if (licenses.length > 0) {
      const code = generateCode();
      await saveSignInCode(address, await hashCode(address, code), CODE_TTL_SECONDS);
      await sendSignInCode(address, code, Math.round(CODE_TTL_SECONDS / 60));
    }
  } catch (error) {
    // Logged, not surfaced — a detailed failure here would also distinguish
    // "no such customer" from "mail is down".
    console.error("[portal/request-code]", error);
  }

  return json({
    ok: true,
    message: "If that address has a license, we've sent it a sign-in code.",
  });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
