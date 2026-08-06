/*
 * License persistence, backed by Upstash Redis over its REST API.
 *
 * SERVER ONLY. Never import from src/.
 *
 * REST rather than an SDK because these run on the Edge runtime, where the
 * node-redis TCP client can't open a socket. Plain fetch works everywhere.
 *
 * Two records per license:
 *
 *   license:order:<orderId>  -> key      claimed with SET NX, which is what
 *                                        makes ensureLicense idempotent
 *   license:key:<key>        -> record   the license itself
 *
 * The order key is the lock. The webhook and the success page routinely fire
 * within milliseconds of each other; whoever wins SET NX mints, and the loser
 * reads back the winner's key rather than minting a second one.
 */

/* Vercel's Upstash integration provides KV_*; a directly-provisioned Upstash
   database provides UPSTASH_*. Accept either so neither setup needs edits. */
const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

export const storeConfigured = Boolean(REST_URL && REST_TOKEN);

const orderKey = (orderId) => `license:order:${orderId}`;
const licenseKey = (key) => `license:key:${key}`;

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

export async function readLicenseByKey(key) {
  return parse(await command(["GET", licenseKey(key)]));
}

export async function readLicenseByOrder(orderId) {
  const key = await command(["GET", orderKey(orderId)]);
  if (!key) return null;
  return readLicenseByKey(key);
}

/**
 * Claims the order id and stores the license. If another caller claimed it
 * first, that winner's license is returned and the caller's candidate key is
 * discarded — never written, never seen.
 */
export async function writeLicense(license) {
  const claimed = await command(["SET", orderKey(license.order_id), license.key, "NX"]);

  if (claimed !== "OK") {
    const winner = await readLicenseByOrder(license.order_id);
    if (winner) return winner;
    // Claim exists but the record doesn't — a crash between the two writes.
    // Fall through and write ours against the claimed key.
  }

  await command(["SET", licenseKey(license.key), JSON.stringify(license)]);
  return license;
}

export async function updateLicense(key, patch) {
  const existing = await readLicenseByKey(key);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await command(["SET", licenseKey(key), JSON.stringify(updated)]);
  return updated;
}

/* ── email index ──
   A set rather than a string: one address can buy more than once, and losing
   the earlier purchase would be worse than carrying a small set. */

const emailKey = (email) => `license:email:${email.trim().toLowerCase()}`;

export async function indexLicenseEmail(email, key) {
  if (!email) return;
  await command(["SADD", emailKey(email), key]);
}

export async function readLicenseKeysByEmail(email) {
  if (!email) return [];
  const members = await command(["SMEMBERS", emailKey(email)]);
  return Array.isArray(members) ? members : [];
}

/* ── portal sign-in codes ──
   Stored hashed with a short TTL. A store dump must not hand over live codes. */

const codeKey = (email) => `portal:code:${email.trim().toLowerCase()}`;

export async function saveSignInCode(email, codeHash, ttlSeconds) {
  await command(["SET", codeKey(email), codeHash, "EX", String(ttlSeconds)]);
}

export async function readSignInCode(email) {
  return command(["GET", codeKey(email)]);
}

export async function clearSignInCode(email) {
  await command(["DEL", codeKey(email)]);
}
