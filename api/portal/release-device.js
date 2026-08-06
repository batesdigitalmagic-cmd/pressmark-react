/*
 * Releases one activated device from the portal.
 *
 * Requires a valid session token AND that the license actually belongs to the
 * session's email — holding a session for one address must never let you touch
 * another customer's license.
 */

import {
  deactivateDevice,
  getLicensesByEmail,
  publicLicense,
} from "../../lib/licenses.js";
import { readSession } from "../../lib/portal-session.js";
import { clientIp, rateLimit, tooManyRequests } from "../../lib/rate-limit.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const limited = await rateLimit("portal-release", clientIp(request), {
    limit: 20,
    windowSeconds: 900,
  });
  if (!limited.ok) return tooManyRequests(limited.resetSeconds);

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const email = await readSession(token);
  if (!email) {
    return json({ error: "Your portal session has expired. Sign in again." }, 401);
  }

  const { key, device_id: deviceId } = await request.json().catch(() => ({}));
  if (!key || !deviceId) {
    return json({ error: "Missing license key or device." }, 400);
  }

  try {
    // Ownership check: only licenses on this session's email are reachable.
    const owned = await getLicensesByEmail(email);
    const license = owned.find((l) => l.key === key);
    if (!license) {
      return json({ error: "That license is not on this account." }, 403);
    }

    const result = await deactivateDevice(key, deviceId);
    if (!result.ok) {
      return json(
        {
          error:
            result.reason === "not_activated"
              ? "That computer is already released."
              : "We could not release that computer.",
        },
        400
      );
    }

    return json({ ok: true, license: publicLicense(result.license) });
  } catch (error) {
    console.error("[portal/release-device]", error);
    return json({ error: "We could not release that computer just now." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
