/*
 * Which Redis the B2B platform talks to.
 *
 * SERVER ONLY.
 *
 * ── Two databases, one rule ──
 *
 * The existing site (licences, sandbox) and the render-job queue use the shared
 * database from KV_REST_API_URL / KV_REST_API_TOKEN. Customer accounts, orgs and
 * projects can live in their own database so they are never mixed with licences
 * and cannot be affected by anything done to that one.
 *
 * The platform uses a dedicated database ONLY when BOTH of these are set:
 *
 *   PLATFORM_REDIS_REST_URL
 *   PLATFORM_REDIS_REST_TOKEN
 *
 * Neither set: it uses the shared database, exactly as before. One set without
 * the other is a misconfiguration and is refused loudly, never silently routed
 * to a different database than the operator intended.
 *
 * ── Why new names and not UPSTASH_REDIS_REST_* ──
 *
 * lib/license-store.js falls back to UPSTASH_REDIS_REST_* whenever KV_REST_API_*
 * is missing. If the platform's database lived under that name, removing the KV
 * variables would silently point the licence store at the platform database. A
 * distinct name makes that impossible: nothing else reads it.
 *
 * ── What stays on the shared database, and why that is fine ──
 *
 * The render-job queue (renderjob:*) must stay where the worker and the existing
 * endpoints read it, so the platform still submits jobs there through jobs.js.
 * A project record holds a job id; it never needs a cross-database transaction.
 * Every platform lock (plat:submit, plat:proof, plat:decide) lives with the
 * platform data it protects.
 */

import { command as sharedCommand, kvConfigured as sharedConfigured, usingLocalKv } from "../render-jobs/kv.js";

export function platformRedisConfig(env = process.env) {
  const url = String(env.PLATFORM_REDIS_REST_URL || "").trim();
  const token = String(env.PLATFORM_REDIS_REST_TOKEN || "").trim();
  if (!url && !token) return { mode: "shared" };
  if (!url || !token) {
    return { mode: "invalid", problem: "Set BOTH PLATFORM_REDIS_REST_URL and PLATFORM_REDIS_REST_TOKEN, or neither." };
  }
  if (!/^https:\/\//.test(url)) return { mode: "invalid", problem: "PLATFORM_REDIS_REST_URL must be an https URL." };
  return { mode: "dedicated", url, token };
}

export function platformRedisMode(env = process.env) {
  if (usingLocalKv()) return "local";
  return platformRedisConfig(env).mode;
}

export function platformStoreConfigured(env = process.env) {
  if (usingLocalKv()) return true;
  const config = platformRedisConfig(env);
  if (config.mode === "dedicated") return true;
  if (config.mode === "invalid") return false;
  return sharedConfigured();
}

export function platformStoreProblem(env = process.env) {
  const config = platformRedisConfig(env);
  return config.mode === "invalid" ? config.problem : "";
}

/** One Redis command against the platform's database. */
export async function platformCommand(args, { env = process.env, fetchImpl = fetch } = {}) {
  if (usingLocalKv()) return sharedCommand(args); /* in-process emulation */
  const config = platformRedisConfig(env);
  if (config.mode === "invalid") throw new Error(config.problem);
  if (config.mode === "shared") return sharedCommand(args);

  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(`Platform store error: ${body.error || response.status}`);
  return body.result;
}
