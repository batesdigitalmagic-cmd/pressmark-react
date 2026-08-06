/*
 * Fixed-window rate limiting on Upstash Redis.
 *
 * SERVER ONLY.
 *
 * INCR then EXPIRE on first hit. Fixed windows allow a burst at a boundary,
 * which is fine here — the goal is stopping key harvesting and brute force,
 * not perfectly smooth traffic shaping.
 *
 * Fails OPEN on store errors. A Redis blip must not lock paying customers out
 * of their own licenses; the endpoints behind this are not destructive.
 */

import { command, storeConfigured } from "./license-store.js";

/** @returns {Promise<{ok: boolean, remaining: number, resetSeconds: number}>} */
export async function rateLimit(bucket, identifier, { limit, windowSeconds }) {
  if (!storeConfigured) return { ok: true, remaining: limit, resetSeconds: 0 };

  const key = `rl:${bucket}:${identifier}`;
  try {
    const hits = Number(await command(["INCR", key]));
    if (hits === 1) await command(["EXPIRE", key, String(windowSeconds)]);

    if (hits > limit) {
      const ttl = Number(await command(["TTL", key])) || windowSeconds;
      return { ok: false, remaining: 0, resetSeconds: ttl };
    }
    return { ok: true, remaining: limit - hits, resetSeconds: windowSeconds };
  } catch (error) {
    console.error("[rate-limit] store error, failing open:", error.message);
    return { ok: true, remaining: limit, resetSeconds: 0 };
  }
}

/** Vercel puts the real client IP here; everything else is spoofable. */
export function clientIp(request) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown"
  );
}

export function tooManyRequests(resetSeconds) {
  return new Response(
    JSON.stringify({
      error: `Too many attempts. Try again in ${Math.ceil(resetSeconds / 60)} minute(s).`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(resetSeconds),
        "Cache-Control": "no-store",
      },
    }
  );
}
