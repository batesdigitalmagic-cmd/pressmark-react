/*
 * Portal request handlers, parameterised by mode.
 *
 * SERVER ONLY.
 *
 * The live and sandbox portals run identical logic against separate Redis
 * namespaces. Mode is bound once, at the route file — it is never read from
 * the request. That is the whole isolation guarantee: there is no parameter a
 * caller could set to make the sandbox portal read production licences.
 *
 * Rate-limit buckets are namespaced too, so hammering the sandbox during
 * testing cannot lock a real customer out of their own portal.
 */

import { LIVE, TEST, getLicensesByEmail, publicLicense } from "./licenses.js";
import { clearSignInCode, readSignInCode, saveSignInCode } from "./license-store.js";
import { createSession, generateCode, hashCode, readSession } from "./portal-session.js";
import { deactivateDevice } from "./licenses.js";
import { sendSignInCode } from "./email.js";
import { clientIp, rateLimit, tooManyRequests } from "./rate-limit.js";
import { logger } from "./log.js";

const CODE_TTL_SECONDS = 10 * 60;

const bucket = (name, mode) => (mode === TEST ? `sandbox-${name}` : name);

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/*
 * Step 1: email a six-digit code.
 *
 * Anti-enumeration: the response is byte-identical whether or not that address
 * has bought anything. Otherwise this becomes a customer-list oracle for
 * anyone with a word list.
 */
export function makeRequestCode(mode = LIVE) {
  const log = logger(`portal-request-code:${mode}`);

  return async function handler(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const byIp = await rateLimit(bucket("portal-request", mode), clientIp(request), {
      limit: 5,
      windowSeconds: 900,
    });
    if (!byIp.ok) return tooManyRequests(byIp.resetSeconds);

    const { email } = await request.json().catch(() => ({}));
    const address = String(email || "").trim().toLowerCase();

    if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return json({ error: "Enter the email address you used to buy BatchCutout." }, 400);
    }

    // A second bucket on the address, so an attacker rotating IPs still can't
    // mailbomb one customer.
    const byEmail = await rateLimit(bucket("portal-request-email", mode), address, {
      limit: 5,
      windowSeconds: 900,
    });
    if (!byEmail.ok) return tooManyRequests(byEmail.resetSeconds);

    try {
      const licenses = await getLicensesByEmail(address, mode);

      if (licenses.length > 0) {
        const code = generateCode();
        await saveSignInCode(address, await hashCode(address, code), CODE_TTL_SECONDS, mode);
        await sendSignInCode(address, code, Math.round(CODE_TTL_SECONDS / 60));
      }
    } catch (error) {
      // Logged, not surfaced — a detailed failure would also distinguish
      // "no such customer" from "mail is down".
      log.error("request-code failed", error);
    }

    return json({
      ok: true,
      message: "If that address has a license, we've sent it a sign-in code.",
    });
  };
}

/** Step 2: exchange the code for a session token scoped to this mode. */
export function makeVerifyCode(mode = LIVE) {
  const log = logger(`portal-verify-code:${mode}`);

  return async function handler(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const byIp = await rateLimit(bucket("portal-verify", mode), clientIp(request), {
      limit: 10,
      windowSeconds: 900,
    });
    if (!byIp.ok) return tooManyRequests(byIp.resetSeconds);

    const { email, code } = await request.json().catch(() => ({}));
    const address = String(email || "").trim().toLowerCase();
    const submitted = String(code || "").trim();

    if (!address || !submitted) {
      return json({ error: "Enter your email address and the code we sent you." }, 400);
    }

    const perEmail = await rateLimit(bucket("portal-verify-email", mode), address, {
      limit: 5,
      windowSeconds: 900,
    });
    if (!perEmail.ok) return tooManyRequests(perEmail.resetSeconds);

    try {
      const stored = await readSignInCode(address, mode);
      if (!stored) {
        return json({ error: "That code has expired. Request a new one." }, 401);
      }

      if (stored !== (await hashCode(address, submitted))) {
        return json({ error: "That code is not correct. Check the email and try again." }, 401);
      }

      // Single use — a code that worked once must not work again.
      await clearSignInCode(address, mode);

      const licenses = await getLicensesByEmail(address, mode);
      return json({
        token: await createSession(address, mode),
        licenses: licenses.map(publicLicense),
      });
    } catch (error) {
      log.error("verify-code failed", error);
      return json({ error: "We could not open your portal just now. Try again shortly." }, 500);
    }
  };
}

/**
 * Releases one activated device.
 *
 * Requires a session token minted in THIS mode, and that the licence belongs
 * to that session's email. A sandbox token is rejected outright by the live
 * route, because readSession checks the mode baked into the token.
 */
export function makeReleaseDevice(mode = LIVE) {
  const log = logger(`portal-release:${mode}`);

  return async function handler(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const limited = await rateLimit(bucket("portal-release", mode), clientIp(request), {
      limit: 20,
      windowSeconds: 900,
    });
    if (!limited.ok) return tooManyRequests(limited.resetSeconds);

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const email = await readSession(token, mode);
    if (!email) {
      return json({ error: "Your portal session has expired. Sign in again." }, 401);
    }

    const { key, device_id: deviceId } = await request.json().catch(() => ({}));
    if (!key || !deviceId) {
      return json({ error: "Missing license key or device." }, 400);
    }

    try {
      // Ownership check within this namespace only.
      const owned = await getLicensesByEmail(email, mode);
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
      log.error("release-device failed", error);
      return json({ error: "We could not release that computer just now." }, 500);
    }
  };
}
