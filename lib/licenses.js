/*
 * License issuance and revocation.
 *
 * SERVER ONLY. Carries LICENSE_SIGNING_SECRET and, when configured, the
 * license server admin token — which grants access to every license ever
 * issued. Never import this from src/.
 *
 * ── Two backends, one interface ──
 *
 * The exported functions match the reference license-server client exactly
 * (same names, arguments, and License shape), so which backend runs is
 * invisible to callers:
 *
 *   LICENSE_API_URL set    -> remote: proxy to the license server, which stays
 *                             the source of truth. Nothing is reimplemented.
 *   LICENSE_API_URL unset  -> local: mint and store keys here.
 *
 * That means standing up license.pressmark.studio later is an env var change,
 * not a rewrite.
 */

import {
  LIVE,
  TEST,
  indexLicenseEmail,
  readLicenseByKey,
  readLicenseByOrder,
  readLicenseKeysByEmail,
  writeLicense,
  updateLicense,
} from "./license-store.js";
import { CURRENT } from "./releases.js";
import { DEFAULT_PRODUCT, resolveProduct } from "./products.js";

export { LIVE, TEST };

/* One license server per mode, never mixed — the same rule lib/stripe.js
   follows. Live points at license.pressmark.studio; sandbox can point at a
   staging copy so test purchases never write to the production database.
   A mode with no URL keeps using the local (Upstash) backend. */
const REMOTE = {
  [LIVE]: {
    url: (process.env.LICENSE_API_URL || "").trim().replace(/\/+$/, ""),
    token: (process.env.LICENSE_ADMIN_TOKEN || "").trim(),
  },
  [TEST]: {
    url: (process.env.LICENSE_API_URL_TEST || "").trim().replace(/\/+$/, ""),
    token: (process.env.LICENSE_ADMIN_TOKEN_TEST || "").trim(),
  },
};

/** True when this mode forwards to a license server instead of Upstash. */
export function remoteFor(mode = LIVE) {
  return Boolean(REMOTE[mode]?.url);
}

/* Back-compat: existing readers (api/health.js) mean live. */
export const usingRemoteServer = remoteFor(LIVE);

/**
 * @typedef {Object} License
 * @property {string} key
 * @property {string|null} email
 * @property {string|null} name
 * @property {string} plan
 * @property {number} max_devices
 * @property {string|null} order_id
 * @property {number} created_at
 * @property {number|null} updates_until
 * @property {number} revoked
 */

/* ── remote backend ── */

async function call(path, init, mode = LIVE) {
  const remote = REMOTE[mode];
  const response = await fetch(remote.url + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${remote.token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(body.message || `License API returned ${response.status}`);
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

/* ── local backend ── */

const KEY_GROUPS = 4;
const KEY_GROUP_SIZE = 5;
/* Crockford base32: no I, L, O, or U. Removes the 1/I and 0/O ambiguity that
   generates support mail when someone types a key off a screen. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/* Sandbox keys carry their own prefix. That makes the namespace derivable
   from the key alone, so the activation endpoints route correctly without
   trusting a mode flag from the Photoshop script — and a test key is obvious
   to a human reading a support email. */
export const LIVE_KEY_PREFIX = "PMBC";
export const TEST_KEY_PREFIX = "PMBCT";

function mintKey(mode) {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_GROUPS * KEY_GROUP_SIZE));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  const groups = [];
  for (let i = 0; i < KEY_GROUPS; i++) {
    groups.push(chars.slice(i * KEY_GROUP_SIZE, (i + 1) * KEY_GROUP_SIZE).join(""));
  }
  const prefix = mode === TEST ? TEST_KEY_PREFIX : LIVE_KEY_PREFIX;
  return `${prefix}-${groups.join("-")}`;
}

/** Which namespace a key belongs to, derived from the key itself. */
export function modeForKey(key) {
  return String(key || "").toUpperCase().startsWith(`${TEST_KEY_PREFIX}-`) ? TEST : LIVE;
}

function monthsFromNow(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return Math.floor(date.getTime() / 1000);
}

/* ── public interface ── */

/**
 * Create the license for an order, or return the one that already exists.
 * Safe to call any number of times for the same orderId — which is the whole
 * point, since both the webhook and the success page call it. Whichever
 * arrives first mints; the other reads back the same key.
 *
 * @returns {Promise<{ created: boolean, license: License }>}
 */
export async function ensureLicense(input) {
  const {
    orderId,
    email = null,
    name = null,
    maxDevices = 2,
    plan = "standard",
    updateMonths = 12,
    sendEmail = true,
    livemode = true,
    product: rawProduct,
  } = input;

  const mode = livemode ? LIVE : TEST;
  const product = resolveProduct(rawProduct);
  if (!product) {
    throw Object.assign(new Error(`Unknown product: ${rawProduct}`), { code: "unknown_product" });
  }

  if (remoteFor(mode)) {
    return call("/admin/licenses/ensure", {
      method: "POST",
      body: JSON.stringify({
        product,
        order_id: orderId,
        email,
        name,
        max_devices: maxDevices,
        plan,
        update_months: updateMonths,
        source: livemode ? "stripe" : "stripe-test",
        send_email: sendEmail !== false,
      }),
    }, mode);
  }

  /* The local backend mints BatchCutout (PMBC) keys only. Every plugin that
     activates against license.pressmark.studio would reject anything else
     minted here, so refuse instead of selling a key that cannot work. */
  if (product !== DEFAULT_PRODUCT) {
    throw Object.assign(
      new Error(`${product} licenses need LICENSE_API_URL${mode === TEST ? "_TEST" : ""} (license server) to be set.`),
      { code: "remote_required" }
    );
  }

  const existing = await readLicenseByOrder(orderId, mode);
  if (existing) return { created: false, license: existing };

  const license = {
    key: mintKey(mode),
    product: DEFAULT_PRODUCT,
    email,
    name,
    plan,
    max_devices: maxDevices,
    order_id: orderId,
    created_at: Math.floor(Date.now() / 1000),
    updates_until: monthsFromNow(updateMonths),
    revoked: 0,
    // The version bought, frozen at purchase. Not CURRENT_VERSION at read
    // time — that would silently rewrite history every release. The value
    // tracks the shipping release rather than a hard-coded "1.0.0", which
    // would stamp new purchases with a version they did not buy.
    //
    // This is the ONLY place a version is ever written. It is reached only
    // after the `if (existing)` return above, so it applies to newly minted
    // licences and can never re-stamp an issued one; no updateLicense patch
    // in this file carries a version either. An existing key keeps whatever
    // version it was issued with, forever.
    version: CURRENT,
    // Sandbox purchases are tagged so a test licence can never be mistaken
    // for a paying customer's in the portal or in support.
    livemode,
    activations: [],
  };

  /* The store claims the order id atomically. If a concurrent caller won the
     race — the webhook and the success page genuinely do arrive together —
     writeLicense returns the winner and this key is discarded unused. */
  const stored = await writeLicense(license, mode);
  if (email) await indexLicenseEmail(email, stored.key, mode);
  return { created: stored.key === license.key, license: stored };
}

/** Returns null when nothing has been issued for this order yet. */
export async function getLicenseByOrder(orderId, mode = LIVE) {
  if (remoteFor(mode)) {
    try {
      const body = await call(`/admin/licenses/by-order/${encodeURIComponent(orderId)}`, undefined, mode);
      return body.license;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }
  return readLicenseByOrder(orderId, mode);
}

export async function getLicenseByKey(key, mode = modeForKey(key)) {
  if (remoteFor(mode)) {
    try {
      const body = await call(`/admin/licenses/${encodeURIComponent(key)}`, undefined, mode);
      return body.license;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }
  return readLicenseByKey(key, mode);
}

export async function revokeLicenseByOrder(orderId, reason, mode = LIVE) {
  const license = await getLicenseByOrder(orderId, mode);
  if (!license) return false;

  if (remoteFor(mode)) {
    await call(`/admin/licenses/${encodeURIComponent(license.key)}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }, mode);
    return true;
  }

  await updateLicense(license.key, { revoked: 1, revoked_reason: reason }, mode);
  return true;
}

/* ────────────────────────────────────────────────
   Status, projections, and device activation
   ──────────────────────────────────────────────── */

/** Refunds and chargebacks set revoked=1 via the Stripe webhook. */
export function licenseStatus(license) {
  if (!license) return "not_found";
  if (license.revoked) return "revoked";
  return "active";
}

export function updatesExpired(license) {
  return Boolean(license?.updates_until && license.updates_until * 1000 < Date.now());
}

/* A device id is a machine fingerprint from the Photoshop script. Showing it
   whole in the portal would let anyone who saw the screen replay it, so only
   the ends are shown — enough to tell two machines apart, not enough to copy. */
export function maskDeviceId(deviceId) {
  const id = String(deviceId || "");
  if (id.length <= 8) return `${id.slice(0, 2)}••••`;
  return `${id.slice(0, 4)}••••${id.slice(-4)}`;
}

/**
 * The ONLY shape the browser is ever given. Deliberately omits order_id,
 * customer name, revoked_reason, and raw device ids.
 */
export function publicLicense(license) {
  return {
    key: license.key,
    product: license.product || DEFAULT_PRODUCT,
    status: licenseStatus(license),
    version: license.version || null,
    livemode: license.livemode !== false,
    maxDevices: license.max_devices,
    activationCount: (license.activations || []).length,
    updatesUntil: license.updates_until || null,
    updatesExpired: updatesExpired(license),
    purchasedAt: license.created_at || null,
    devices: (license.activations || []).map((a) => ({
      id: a.device_id,
      masked: maskDeviceId(a.device_id),
      name: a.device_name || "Unnamed computer",
      activatedAt: a.activated_at,
      lastSeen: a.last_seen || a.activated_at,
    })),
  };
}

/* ── remote device bridge ──

   BatchCutout v1.0 activates against pressmark.studio/api/license/*, sending
   only its own device id. Once the store forwards to the license server,
   these functions pass those calls through to it so v1.0 customers keep
   working. The license server fingerprints the device fields it is sent, so
   the v1.0 id is placed in `uuid` with fixed companions: the same v1.0
   machine always maps to the same seat. v1.0 only ever sold BatchCutout. */

function legacyDevice(deviceId, deviceName) {
  return {
    uuid: String(deviceId),
    platform: "legacy-v1",
    hostname: "batchcutout-v1",
    username: "",
    device_name: deviceName || null,
  };
}

/* Public /v1 endpoints answer with HTTP errors for refusals; read the body
   either way rather than throwing. */
async function publicCall(path, payload, mode) {
  const response = await fetch(REMOTE[mode].url + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (response.status >= 500) {
    throw new Error(`License server returned ${response.status}`);
  }
  return body;
}

const REMOTE_REASON = {
  INVALID_KEY: "not_found",
  WRONG_PRODUCT: "not_found",
  MALFORMED_KEY: "not_found",
  REVOKED: "revoked",
  EXPIRED: "revoked",
  SEAT_LIMIT_REACHED: "device_limit",
  SEAT_RELEASED: "not_activated",
};

async function remoteActivate(key, deviceId, deviceName, mode) {
  const res = await publicCall("/v1/activate", {
    license_key: key,
    product: DEFAULT_PRODUCT,
    device: legacyDevice(deviceId, deviceName),
    plugin_version: "1.0.0",
  }, mode);
  if (!res.ok) {
    return {
      ok: false,
      reason: REMOTE_REASON[res.code] || "not_found",
      license: res.max_devices ? { max_devices: res.max_devices } : undefined,
    };
  }
  const license = await getLicenseByKey(key, mode);
  return { ok: true, reason: "activated", license };
}

async function remoteValidate(key, deviceId, mode) {
  const res = await publicCall("/v1/validate", {
    license_key: key,
    product: DEFAULT_PRODUCT,
    device: legacyDevice(deviceId),
    plugin_version: "1.0.0",
  }, mode);
  if (!res.ok) {
    const status = REMOTE_REASON[res.code] || "not_found";
    const license = status === "not_activated" ? await getLicenseByKey(key, mode) : undefined;
    return { valid: false, status, license };
  }
  return { valid: true, status: "active", license: await getLicenseByKey(key, mode) };
}

async function remoteDeactivate(key, deviceId, mode) {
  const license = await getLicenseByKey(key, mode);
  if (!license) return { ok: false, reason: "not_found" };

  // The portal passes a device id it was shown (the server's own seat id);
  // release that seat directly. Otherwise it is a v1.0 plugin's own id.
  const seat = (license.activations || []).find((a) => a.device_id === deviceId);
  if (seat) {
    await call(
      `/admin/licenses/${encodeURIComponent(key)}/seats/${encodeURIComponent(String(deviceId).slice(0, 8))}/release`,
      { method: "POST", body: "{}" },
      mode
    );
  } else {
    const res = await publicCall("/v1/deactivate", {
      license_key: key,
      device: legacyDevice(deviceId),
    }, mode);
    if (!res.ok || !res.released) return { ok: false, reason: "not_activated", license };
  }
  return { ok: true, reason: "deactivated", license: await getLicenseByKey(key, mode) };
}

/**
 * Activates a device, or refreshes it if already activated.
 *
 * Read-modify-write rather than a lock: at this volume two activations
 * landing in the same millisecond is not a real scenario, and the worst case
 * is one extra slot, not a lost or duplicated license.
 */
export async function activateDevice(key, deviceId, deviceName) {
  const mode = modeForKey(key);
  if (remoteFor(mode)) return remoteActivate(key, deviceId, deviceName, mode);

  const license = await readLicenseByKey(key, mode);
  if (!license) return { ok: false, reason: "not_found" };
  if (license.revoked) return { ok: false, reason: "revoked" };

  const activations = license.activations || [];
  const now = Math.floor(Date.now() / 1000);
  const existing = activations.find((a) => a.device_id === deviceId);

  if (existing) {
    existing.last_seen = now;
    if (deviceName) existing.device_name = deviceName;
    const updated = await updateLicense(key, { activations }, mode);
    return { ok: true, reason: "already_active", license: updated };
  }

  if (activations.length >= license.max_devices) {
    return { ok: false, reason: "device_limit", license };
  }

  activations.push({
    device_id: deviceId,
    device_name: deviceName || null,
    activated_at: now,
    last_seen: now,
  });

  const updated = await updateLicense(key, { activations }, mode);
  return { ok: true, reason: "activated", license: updated };
}

export async function deactivateDevice(key, deviceId) {
  const mode = modeForKey(key);
  if (remoteFor(mode)) return remoteDeactivate(key, deviceId, mode);

  const license = await readLicenseByKey(key, mode);
  if (!license) return { ok: false, reason: "not_found" };

  const activations = license.activations || [];
  const remaining = activations.filter((a) => a.device_id !== deviceId);
  if (remaining.length === activations.length) {
    return { ok: false, reason: "not_activated", license };
  }

  const updated = await updateLicense(key, { activations: remaining }, mode);
  return { ok: true, reason: "deactivated", license: updated };
}

/** Read-only check for the Photoshop script at launch. */
export async function validateDevice(key, deviceId) {
  const mode = modeForKey(key);
  if (remoteFor(mode)) return remoteValidate(key, deviceId, mode);

  const license = await readLicenseByKey(key, modeForKey(key));
  if (!license) return { valid: false, status: "not_found" };
  if (license.revoked) return { valid: false, status: "revoked" };

  const active = (license.activations || []).some((a) => a.device_id === deviceId);
  if (!active) return { valid: false, status: "not_activated", license };

  return { valid: true, status: "active", license };
}

/** Portal lookup. Returns every license bought with this address. */
export async function getLicensesByEmail(email, mode = LIVE) {
  if (remoteFor(mode)) {
    const body = await call(`/admin/licenses/by-email/${encodeURIComponent(email)}`, undefined, mode);
    return body.licenses || [];
  }
  const keys = await readLicenseKeysByEmail(email, mode);
  const licenses = await Promise.all(keys.map((key) => readLicenseByKey(key, mode)));
  return licenses.filter(Boolean);
}
