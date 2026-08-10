/*
 * Device activation, validation, and deactivation for the Photoshop script.
 *
 *   POST /api/license/activate    { key, device_id, device_name }
 *   POST /api/license/validate    { key, device_id }
 *   POST /api/license/deactivate  { key, device_id }
 *
 * The script ships to customers, so it can hold no secret — the license key
 * IS the credential. That makes rate limiting the primary defence against
 * someone grinding through the key space, hence the tight per-IP and per-key
 * buckets below.
 *
 * Responses carry only what the plugin needs to make a decision. Never the
 * customer record, never other devices' ids.
 */

import {
  activateDevice,
  deactivateDevice,
  licenseStatus,
  updatesExpired,
  validateDevice,
} from "../../lib/licenses.js";
import { clientIp, rateLimit, tooManyRequests } from "../../lib/rate-limit.js";

export const config = { runtime: "edge" };

/* PMBC- live, PMBCT- sandbox. The prefix routes the lookup to the right
   Redis namespace inside lib/licenses.js. */
const KEY_PATTERN = /^PMBCT?(-[0-9A-Z]{5}){4}$/;

const LICENSE_TOKEN_SECRET = process.env.LICENSE_SIGNING_SECRET || "";
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function signLicenseToken(data) {
  if (!LICENSE_TOKEN_SECRET) {
    throw new Error("LICENSE_SIGNING_SECRET is not set.");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LICENSE_TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return base64url(
    await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  );
}

async function createLicenseToken(deviceId, license) {
  const now = Math.floor(Date.now() / 1000);

  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        product: "batchcutout",
        device_id: deviceId,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
        max_devices: license.max_devices,
      })
    )
  );

  return `${payload}.${await signLicenseToken(payload)}`;
}

export default async function handler(request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const action = new URL(request.url).pathname.split("/").pop();

  const byIp = await rateLimit("license-device", clientIp(request), {
    limit: 30,
    windowSeconds: 900,
  });
  if (!byIp.ok) return tooManyRequests(byIp.resetSeconds);

  const { key, device_id: deviceId, device_name: deviceName } =
    await request.json().catch(() => ({}));

  const licenseKey = String(key || "").trim().toUpperCase();
  const device = String(deviceId || "").trim();

  // Shape-check before touching the store: a malformed key is a guess, and
  // guesses shouldn't cost a lookup.
  if (!KEY_PATTERN.test(licenseKey)) {
    return json({ valid: false, status: "invalid_key", error: "That licence key is not valid." }, 400);
  }
  if (!device || device.length > 128) {
    return json({ valid: false, status: "invalid_device", error: "Missing device id." }, 400);
  }

  const byKey = await rateLimit("license-device-key", licenseKey, {
    limit: 20,
    windowSeconds: 900,
  });
  if (!byKey.ok) return tooManyRequests(byKey.resetSeconds);

  try {
if (action === "validate") {
  const result = await validateDevice(licenseKey, device);

  const token =
    result.valid && result.license
      ? await createLicenseToken(device, result.license)
      : null;

  return json({
    valid: result.valid,
    status: result.status,
    token: token,
    updatesExpired: result.license ? updatesExpired(result.license) : null,
    version: result.license?.version ?? null,
  });
}

    if (action === "deactivate") {
      /* Releases the seat. Deliberately returns no token: the device no
         longer holds this licence, and handing back a signed token would let
         it keep running for the token's full 30-day life. */
      const result = await deactivateDevice(licenseKey, device);

      if (!result.ok) {
        const messages = {
          not_found: "That licence key was not found.",
          not_activated: "That computer is not currently activated.",
        };
        return json(
          { ok: false, status: result.reason, error: messages[result.reason] || "Could not release that computer." },
          result.reason === "not_found" ? 404 : 400
        );
      }

      return json({
        ok: true,
        status: "deactivated",
        token: null,
        activations: (result.license.activations || []).length,
        maxDevices: result.license.max_devices,
      });
    }

    // default: activate
    const result = await activateDevice(licenseKey, device, deviceName);

    if (!result.ok) {
      const status = result.reason;
      const messages = {
        not_found: "That licence key was not found.",
        revoked: "This licence has been revoked and can no longer be activated.",
        device_limit: `This licence is already active on ${result.license?.max_devices ?? 2} computers. Release one in the portal at pressmark.studio/portal, then try again.`,
      };
      return json(
        { ok: false, valid: false, status, error: messages[status] || "Activation failed." },
        status === "not_found" ? 404 : 403
      );
    }

    const token = await createLicenseToken(device, result.license);
    return json({
      ok: true,
      valid: true,
      token: token,
      status: licenseStatus(result.license),
      activations: (result.license.activations || []).length,
      maxDevices: result.license.max_devices,
      updatesUntil: result.license.updates_until,
      updatesExpired: updatesExpired(result.license),
      version: result.license.version,
    });
  } catch (error) {
    console.error(`[license/${action}]`, error);
    return json({ error: "Licence server unavailable. Try again shortly." }, 500);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
