/*
 * Step 2 of portal sign-in: exchange the emailed code for a session token,
 * and return the licenses for that address.
 *
 * Only publicLicense() shapes cross the wire — never the stored record.
 */

import { getLicensesByEmail, publicLicense } from "../../lib/licenses.js";
import { clearSignInCode, readSignInCode } from "../../lib/license-store.js";
import { createSession, hashCode } from "../../lib/portal-session.js";
import { clientIp, rateLimit, tooManyRequests } from "../../lib/rate-limit.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip = clientIp(request);
  const limited = await rateLimit("portal-verify", ip, { limit: 10, windowSeconds: 900 });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);

  const { email, code } = await request.json().catch(() => ({}));
  const address = String(email || "").trim().toLowerCase();
  const submitted = String(code || "").trim();

  if (!address || !submitted) {
    return json({ error: "Enter your email address and the code we sent you." }, 400);
  }

  // Per-address bucket so a fixed target can't be brute forced from many IPs.
  const perEmail = await rateLimit("portal-verify-email", address, {
    limit: 5,
    windowSeconds: 900,
  });
  if (!perEmail.ok) return tooManyRequests(perEmail.resetSeconds);

  try {
    const stored = await readSignInCode(address);
    if (!stored) {
      return json({ error: "That code has expired. Request a new one." }, 401);
    }

    if (stored !== (await hashCode(address, submitted))) {
      return json({ error: "That code is not correct. Check the email and try again." }, 401);
    }

    // Single use — a code that worked once must not work again.
    await clearSignInCode(address);

    const licenses = await getLicensesByEmail(address);
    return json({
      token: await createSession(address),
      licenses: licenses.map(publicLicense),
    });
  } catch (error) {
    console.error("[portal/verify-code]", error);
    return json({ error: "We could not open your portal just now. Try again shortly." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
