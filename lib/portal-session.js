/*
 * Short-lived signed tokens proving someone controls a purchase email.
 *
 * SERVER ONLY — reads PORTAL_SESSION_SECRET.
 *
 * Stateless by design: the token carries the email and an expiry, signed with
 * HMAC-SHA256. Nothing to look up, nothing to clean up, and a stolen token
 * dies on its own.
 *
 * WebCrypto rather than node:crypto so it runs on the Edge runtime.
 */

const SECRET = process.env.PORTAL_SESSION_SECRET || "";
const TTL_SECONDS = 30 * 60;

const encoder = new TextEncoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(data) {
  if (!SECRET) throw new Error("PORTAL_SESSION_SECRET is not set.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Sign-in codes are stored hashed, so a store dump yields nothing usable. */
export async function hashCode(email, code) {
  return sign(`code:${email.trim().toLowerCase()}:${code}`);
}

export async function createSession(email) {
  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        email: email.trim().toLowerCase(),
        exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
      })
    )
  );
  return `${payload}.${await sign(payload)}`;
}

/** @returns {Promise<string|null>} the verified email, or null */
export async function readSession(token) {
  if (!token || typeof token !== "string") return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = await sign(payload);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
          c.charCodeAt(0)
        )
      )
    );
    if (!decoded.exp || decoded.exp * 1000 < Date.now()) return null;
    return decoded.email || null;
  } catch {
    return null;
  }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Six digits — long enough against 5 tries, short enough to retype. */
export function generateCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}
