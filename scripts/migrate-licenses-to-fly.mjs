/*
 * Copy every LIVE BatchCutout license from the storefront's store (Upstash /
 * Vercel KV) into the license server (license.pressmark.studio), so the
 * storefront can switch to forwarding (LICENSE_API_URL) without stranding a
 * single customer.
 *
 *   node --env-file=.env scripts/migrate-licenses-to-fly.mjs            # dry run
 *   node --env-file=.env scripts/migrate-licenses-to-fly.mjs --apply    # write
 *
 * Needs: KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_ pair),
 *        LICENSE_API_URL + LICENSE_ADMIN_TOKEN (the license server's ADMIN_TOKEN).
 *
 * Safe by construction:
 *   - Dry run unless --apply. A dry run reads only.
 *   - Upstash is never written to. The storefront copy stays as a fallback.
 *   - The license server refuses to overwrite a key (409 KEY_EXISTS), so a
 *     second run skips what the first one copied. Re-running is harmless.
 *   - Sandbox records (sandbox:license:*) are never read.
 *   - Keys and emails are never printed whole.
 *
 * Activated computers: BatchCutout v1.0 activated against the storefront with
 * its own device id. Each one is re-registered on the license server through
 * /v1/activate, using exactly the device mapping lib/licenses.js uses for v1.0
 * after the switch, so those computers stay activated without the customer
 * noticing.
 */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const API = (process.env.LICENSE_API_URL || "").trim().replace(/\/+$/, "");
const ADMIN = (process.env.LICENSE_ADMIN_TOKEN || "").trim();
const APPLY = process.argv.includes("--apply");

const mask = (key) => `${String(key).slice(0, 9)}…`;
const maskEmail = (email) => {
  if (!email) return "(no email)";
  const [user, domain] = String(email).split("@");
  return `${user.slice(0, 1)}***@${domain || "?"}`;
};

function need(name, value) {
  if (!value) {
    console.error(`Missing ${name}. Run with --env-file=.env and set it there.`);
    process.exit(2);
  }
}
need("KV_REST_API_URL / UPSTASH_REDIS_REST_URL", KV_URL);
need("KV_REST_API_TOKEN / UPSTASH_REDIS_REST_TOKEN", KV_TOKEN);
need("LICENSE_API_URL", API);
need("LICENSE_ADMIN_TOKEN", ADMIN);

async function kv(args) {
  const res = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`KV ${args[0]} failed: ${body.error || res.status}`);
  return body.result;
}

async function server(path, { method = "GET", body, admin = true } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(admin ? { Authorization: `Bearer ${ADMIN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/* Same mapping as legacyDevice() in lib/licenses.js. Keep them identical. */
function legacyDevice(deviceId, deviceName) {
  return {
    uuid: String(deviceId),
    platform: "legacy-v1",
    hostname: "batchcutout-v1",
    username: "",
    device_name: deviceName || null,
  };
}

async function liveLicenseKeys() {
  const keys = [];
  let cursor = "0";
  do {
    const [next, batch] = await kv(["SCAN", cursor, "MATCH", "license:key:*", "COUNT", "200"]);
    cursor = String(next);
    for (const k of batch) if (!k.startsWith("sandbox:")) keys.push(k);
  } while (cursor !== "0");
  return keys;
}

const health = await server("/health", { admin: false });
if (health.status !== 200 || !health.body.ok) {
  console.error(`License server not healthy at ${API} (status ${health.status}). Stopping.`);
  process.exit(1);
}
const auth = await server("/admin/stats");
if (auth.status === 401) {
  console.error("LICENSE_ADMIN_TOKEN was refused by the license server. Stopping.");
  process.exit(1);
}

const storeKeys = await liveLicenseKeys();
console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${storeKeys.length} live license record(s) in the storefront store.\n`);

const totals = { copied: 0, alreadyThere: 0, seats: 0, seatProblems: 0, skipped: 0, failed: 0 };

for (const storeKey of storeKeys) {
  const raw = await kv(["GET", storeKey]);
  const lic = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!lic || !lic.key) {
    totals.skipped++;
    console.log(`  skip ${storeKey}: unreadable record`);
    continue;
  }
  if (lic.livemode === false) {
    totals.skipped++;
    console.log(`  skip ${mask(lic.key)}: marked as a sandbox purchase`);
    continue;
  }

  const activations = Array.isArray(lic.activations) ? lic.activations : [];
  const existing = await server(`/admin/licenses/${encodeURIComponent(lic.key)}`);
  const line = `${mask(lic.key)}  ${maskEmail(lic.email)}  ${lic.revoked ? "REVOKED" : "active"}  ` +
    `${activations.length}/${lic.max_devices || 2} computers`;

  if (existing.status === 200) {
    totals.alreadyThere++;
    console.log(`  already on server  ${line}`);
    continue;
  }

  if (!APPLY) {
    console.log(`  would copy         ${line}`);
    continue;
  }

  const created = await server("/admin/licenses", {
    method: "POST",
    body: {
      key: lic.key,
      product: "batchcutout",
      plan: lic.plan || "standard",
      max_devices: lic.max_devices || 2,
      email: lic.email || null,
      name: lic.name || null,
      order_id: lic.order_id || null,
      source: "storefront-migration",
      updates_until: lic.updates_until || null,
      created_at: lic.created_at || undefined,
      notes: `Copied from pressmark.studio store${lic.version ? `; bought v${lic.version}` : ""}`,
    },
  });

  if (created.status === 409) {
    totals.alreadyThere++;
    console.log(`  already on server  ${line}`);
    continue;
  }
  if (created.status !== 201) {
    totals.failed++;
    console.log(`  FAILED (${created.status} ${created.body.code || ""})  ${line}`);
    continue;
  }
  totals.copied++;
  console.log(`  copied             ${line}`);

  if (lic.revoked) {
    await server(`/admin/licenses/${encodeURIComponent(lic.key)}/revoke`, {
      method: "POST",
      body: { reason: lic.revoked_reason || "refund" },
    });
    console.log(`                     revoked on server too (${lic.revoked_reason || "refund"})`);
    continue;
  }

  for (const a of activations) {
    const seat = await server("/v1/activate", {
      method: "POST",
      admin: false,
      body: {
        license_key: lic.key,
        product: "batchcutout",
        device: legacyDevice(a.device_id, a.device_name),
        plugin_version: "1.0.0",
      },
    });
    if (seat.status === 200) {
      totals.seats++;
    } else {
      totals.seatProblems++;
      console.log(`                     computer not re-registered (${seat.body.code || seat.status})`);
    }
  }
}

console.log(`
Records found:            ${storeKeys.length}
${APPLY ? "Copied" : "Would copy"}:               ${APPLY ? totals.copied : storeKeys.length - totals.alreadyThere - totals.skipped}
Already on server:        ${totals.alreadyThere}
Skipped:                  ${totals.skipped}
Failed:                   ${totals.failed}
Computers re-registered:  ${totals.seats}${totals.seatProblems ? `  (${totals.seatProblems} not)` : ""}
${APPLY ? "" : "\nNothing was written. Re-run with --apply to copy."}`);

process.exit(totals.failed ? 1 : 0);
