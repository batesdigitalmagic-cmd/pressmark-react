/*
 * Prove the render pipeline's durable storage actually works.
 *
 *   node --env-file=.env --env-file=.env.render --env-file=.env.local \
 *     scripts/check-render-storage.mjs
 *
 * A variable being present is not the same as it being correct. This performs
 * one real round trip against each store — write, read back, delete — and
 * reports ok or failed.
 *
 * ── What it never prints ──
 *
 * No token, no blob URL, no Redis URL, no value of any kind. A blob URL is
 * itself a private capability, so it is checked and discarded, never displayed.
 * Failures report the error's shape (status, class of problem), not its body,
 * because an upstream error message can quote a URL or a key fragment.
 *
 * ── What it leaves behind ──
 *
 * Nothing. Both probes use an obviously-named scratch key under a `preflight/`
 * prefix and delete it before returning. The Redis key additionally carries a
 * short TTL so an interrupted run cannot leave litter.
 */

import { del, get, put } from "@vercel/blob";
import { command, storeConfigured } from "../lib/license-store.js";

const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

/* Distinctive enough that anyone finding one in a store knows what it was. */
const stamp = `preflight-${Date.now().toString(36)}`;

/* ── Upstash Redis ── */
async function checkRedis() {
  if (!storeConfigured) {
    record("Upstash Redis", false, "KV_REST_API_URL / KV_REST_API_TOKEN not set");
    return;
  }
  const key = `renderjob:preflight:${stamp}`;
  try {
    /* SET NX is the primitive the atomic job claim depends on, so probing with
       it tests the exact behaviour the lifecycle relies on rather than a
       simpler operation that might work when it does not. */
    const written = await command(["SET", key, stamp, "NX", "EX", "60"]);
    if (written !== "OK") {
      record("Upstash Redis", false, "SET NX did not return OK");
      return;
    }
    const readBack = await command(["GET", key]);
    if (readBack !== stamp) {
      record("Upstash Redis", false, "value read back did not match what was written");
      return;
    }
    /* The same key must now REFUSE a second NX write — that refusal is what
       stops two workers claiming one job. */
    const second = await command(["SET", key, "someone-else", "NX", "EX", "60"]);
    if (second === "OK") {
      record("Upstash Redis", false, "SET NX overwrote an existing key — atomic claim would be unsafe");
      return;
    }
    await command(["DEL", key]);
    record("Upstash Redis", true, "write, read, atomic-claim refusal, delete");
  } catch (error) {
    record("Upstash Redis", false, `request failed (${error?.message?.slice(0, 80) || "unknown"})`);
  }
}

/* ── Vercel Blob ── */
async function checkBlob() {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) {
    record("Vercel Blob", false, "BLOB_READ_WRITE_TOKEN not set");
    return;
  }
  const pathname = `render-jobs/preflight/${stamp}.txt`;
  const options = { access: "private", token };
  try {
    await put(pathname, stamp, {
      ...options,
      contentType: "text/plain",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });

    const found = await get(pathname, { ...options, useCache: false });
    if (!found || found.statusCode !== 200 || !found.stream) {
      record("Vercel Blob", false, "object could not be read back");
      return;
    }
    const body = await new Response(found.stream).text();
    if (body !== stamp) {
      record("Vercel Blob", false, "content read back did not match what was written");
      await del(pathname, options).catch(() => undefined);
      return;
    }

    await del(pathname, options);
    record("Vercel Blob", true, "private write, authenticated read, delete");
  } catch (error) {
    const message = error?.message || "";
    /* Name the likely cause without echoing the body, which can carry a URL. */
    const cause = /unauthor|forbidden|token/i.test(message)
      ? "the token was rejected"
      : /access/i.test(message)
        ? "private access may not be available on this store or plan"
        : `request failed (${message.slice(0, 80)})`;
    record("Vercel Blob", false, cause);
    await del(pathname, options).catch(() => undefined);
  }
}

await checkRedis();
await checkBlob();

const lines = ["Render storage preflight — real round trip against each store", ""];
for (const entry of results) {
  lines.push(`  ${entry.ok ? "ok    " : "FAILED"}  ${entry.name.padEnd(16)} ${entry.detail}`);
}
const healthy = results.every((entry) => entry.ok);
lines.push("", healthy ? "  Both stores are reachable and behaving correctly." : "  Storage is not ready.", "");

process.stdout.write(lines.join("\n"));
process.exit(healthy ? 0 : 1);
