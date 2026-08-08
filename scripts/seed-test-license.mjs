/*
 * Seeds a license directly into Redis so the portal and activation endpoints
 * can be tested before Stripe credentials exist.
 *
 *   npm run seed:license -- --email=you@example.com
 *   npm run seed:license -- --email=you@example.com --revoked
 *
 * Deliberately a script, not an HTTP endpoint. An endpoint that mints licenses
 * is a liability no matter how well it is gated; a script has no public
 * attack surface at all and cannot be reached from the internet.
 *
 * It writes through the same ensureLicense() path production uses, so what it
 * creates is a real license record — not a fixture that drifts from the real
 * shape.
 */

import { ensureLicense, publicLicense } from "../lib/licenses.js";
import { updateLicense } from "../lib/license-store.js";
import { storeConfigured } from "../lib/license-store.js";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const args = process.argv.slice(2);
const email = args.find((a) => a.startsWith("--email="))?.split("=")[1];
const revoked = args.includes("--revoked");
const sandbox = args.includes("--sandbox");

if (!storeConfigured) {
  console.log(`\n${c.red("Redis is not configured.")}`);
  console.log(c.dim("Set KV_REST_API_URL and KV_REST_API_TOKEN in .env.\n"));
  process.exit(1);
}

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.log(`\n${c.red("Pass a valid address:")} npm run seed:license -- --email=you@example.com\n`);
  process.exit(1);
}

const orderId = `test_seed_${Date.now()}`;

const { license } = await ensureLicense({
  orderId,
  email,
  name: "Test Buyer",
  maxDevices: 2,
  updateMonths: 12,
  sendEmail: false,
  livemode: !sandbox,
});

if (revoked) {
  await updateLicense(license.key, { revoked: 1, revoked_reason: "seed --revoked" }, sandbox ? "test" : "live");
}

const stored = publicLicense({ ...license, revoked: revoked ? 1 : 0 });

console.log(`\n${c.green("✓")} ${c.bold("Test license created")}`);
console.log(`  key       ${c.bold(stored.key)}`);
console.log(`  email     ${email}`);
console.log(`  status    ${revoked ? c.red("revoked") : c.green("active")}`);
console.log(`  order id  ${orderId}`);
console.log(`  namespace ${sandbox ? "sandbox: (isolated)" : "live (production)"}`);
console.log(`  devices   ${stored.activationCount} of ${stored.maxDevices}`);

console.log(`\n${c.bold("Try it")}`);
console.log(c.dim(`  Portal:    ${sandbox ? "/sandbox-portal" : "/portal"} → sign in as ${email}`));
console.log(c.dim("  Activate:  curl -s localhost:3000/api/license/activate \\"));
console.log(c.dim(`               -H 'content-type: application/json' \\`));
console.log(c.dim(`               -d '{"key":"${stored.key}","device_id":"test-mac-1","device_name":"Studio iMac"}'`));
console.log(c.dim("\n  This is a real record. Delete it from Redis when you're done.\n"));
