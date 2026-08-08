/*
 * License persistence, backed by Upstash Redis over its REST API.
 *
 * SERVER ONLY. Never import from src/.
 *
 * REST rather than an SDK because these run on the Edge runtime, where the
 * node-redis TCP client can't open a socket. Plain fetch works everywhere.
 *
 * ── Two namespaces, never mixed ──
 *
 *   live     license:order:<id>            portal:code:<email>
 *   sandbox  sandbox:license:order:<id>    sandbox:portal:code:<email>
 *
 * Live keys keep the exact format they have always had, so every existing
 * production record stays readable and nothing needs migrating. Sandbox lives
 * behind a prefix that live lookups never construct — isolation comes from the
 * key builders, not from filtering after the fact, so there is no query that
 * could return the wrong side by omission.
 *
 * Every function takes a mode and defaults to "live", which means a caller
 * that forgets fails safe: it reads production, it never leaks sandbox data
 * into a customer's view.
 *
 * Records per license:
 *
 *   …license:order:<orderId>  -> key      claimed with SET NX, which is what
 *                                         makes ensureLicense idempotent
 *   …license:key:<key>        -> record   the license itself
 *   …license:email:<email>    -> set      the portal's lookup index
 */

export const LIVE = "live";
export const TEST = "test";

/* Vercel's Upstash integration provides KV_*; a directly-provisioned Upstash
   database provides UPSTASH_*. Accept either so neither setup needs edits. */
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const storeConfigured = Boolean(REST_URL && REST_TOKEN);

/** "" for live — preserving the original key format exactly. */
export const namespace = (mode) => (mode === TEST ? "sandbox:" : "");

const orderKey = (orderId, mode) => `${namespace(mode)}license:order:${orderId}`;
const licenseKey = (key, mode) => `${namespace(mode)}license:key:${key}`;
const emailKey = (email, mode) =>
  `${namespace(mode)}license:email:${email.trim().toLowerCase()}`;
const codeKey = (email, mode) =>
  `${namespace(mode)}portal:code:${email.trim().toLowerCase()}`;

export async function command(args) {
  if (!storeConfigured) {
    throw new Error(
      "License store is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN " +
        "(Vercel → Storage → Upstash Redis), or set LICENSE_API_URL to use a remote license server."
    );
  }

  const response = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(`License store error: ${body.error || response.status}`);
  }
  return body.result;
}

function parse(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function readLicenseByKey(key, mode = LIVE) {
  return parse(await command(["GET", licenseKey(key, mode)]));
}

export async function readLicenseByOrder(orderId, mode = LIVE) {
  const key = await command(["GET", orderKey(orderId, mode)]);
  if (!key) return null;
  return readLicenseByKey(key, mode);
}

/**
 * Claims the order id and stores the license. If another caller claimed it
 * first, that winner's license is returned and the caller's candidate key is
 * discarded — never written, never seen.
 */
export async function writeLicense(license, mode = LIVE) {
  const claimed = await command(["SET", orderKey(license.order_id, mode), license.key, "NX"]);

  if (claimed !== "OK") {
    const winner = await readLicenseByOrder(license.order_id, mode);
    if (winner) return winner;
    // Claim exists but the record doesn't — a crash between the two writes.
    // Fall through and write ours against the claimed key.
  }

  await command(["SET", licenseKey(license.key, mode), JSON.stringify(license)]);
  return license;
}

export async function updateLicense(key, patch, mode = LIVE) {
  const existing = await readLicenseByKey(key, mode);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await command(["SET", licenseKey(key, mode), JSON.stringify(updated)]);
  return updated;
}

/* ── email index ──
   A set rather than a string: one address can buy more than once, and losing
   the earlier purchase would be worse than carrying a small set. */

export async function indexLicenseEmail(email, key, mode = LIVE) {
  if (!email) return;
  await command(["SADD", emailKey(email, mode), key]);
}

export async function readLicenseKeysByEmail(email, mode = LIVE) {
  if (!email) return [];
  const members = await command(["SMEMBERS", emailKey(email, mode)]);
  return Array.isArray(members) ? members : [];
}

/* ── portal sign-in codes ──
   Stored hashed with a short TTL. A store dump must not hand over live codes.
   Sandbox codes live in their own namespace, so signing into the sandbox
   portal can never consume or satisfy a production code. */

export async function saveSignInCode(email, codeHash, ttlSeconds, mode = LIVE) {
  await command(["SET", codeKey(email, mode), codeHash, "EX", String(ttlSeconds)]);
}

export async function readSignInCode(email, mode = LIVE) {
  return command(["GET", codeKey(email, mode)]);
}

export async function clearSignInCode(email, mode = LIVE) {
  await command(["DEL", codeKey(email, mode)]);
}
