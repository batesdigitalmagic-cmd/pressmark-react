/*
 * Report whether the render pipeline's environment variables are PRESENT.
 *
 *   node --env-file=.env --env-file=.env.local scripts/check-render-env.mjs
 *
 * ── SET or MISSING. Nothing else. ──
 *
 * This script has no code path that reads a value into its output. It tests
 * emptiness and prints one of two literal words per variable. It does not
 * report length, prefix, shape, or any derived property — a length is a small
 * disclosure, but it is still a disclosure, and a checker that reports one is a
 * checker someone can be tempted to extend.
 *
 * The variables it reads may come from .env, .env.local, or the ambient
 * environment; which file supplied a value is deliberately not reported either,
 * since that is a property of the file rather than of readiness.
 */

/* Literal sentinels written by tooling in place of a real secret. */
const PLACEHOLDERS = new Set(["[SENSITIVE]", "[REDACTED]", "changeme", "xxx"]);

const REQUIRED = [
  { name: "BLOB_READ_WRITE_TOKEN", what: "Vercel Blob — private CSV and PDF storage" },
  { name: "PRESSMARK_WORKER_TOKEN", what: "shared secret between the site and the Mac worker" },
  {
    name: "KV_REST_API_URL",
    what: "Upstash Redis — job state, queue and leases",
    alternates: ["UPSTASH_REDIS_REST_URL"],
  },
  {
    name: "KV_REST_API_TOKEN",
    what: "Upstash Redis auth",
    alternates: ["UPSTASH_REDIS_REST_TOKEN"],
  },
];

let missing = 0;
const rows = [];

for (const entry of REQUIRED) {
  const names = [entry.name, ...(entry.alternates ?? [])];
  /*
   * Presence only: each value is compared and then goes out of scope. It is
   * never assigned to anything that reaches stdout.
   *
   * PLACEHOLDER is its own outcome because `vercel env pull` cannot export
   * secret values from the production environment — it writes the literal
   * "[SENSITIVE]" instead. Reporting that as SET would be a lie that only
   * surfaces later as an authentication failure against real storage. Naming a
   * known non-secret sentinel discloses nothing; it reports the ABSENCE of a
   * secret, which is the opposite of a leak.
   */
  const state = names.reduce((found, name) => {
    if (found !== "MISSING") return found;
    const value = (process.env[name] || "").trim();
    if (value.length === 0) return "MISSING";
    return PLACEHOLDERS.has(value) ? "PLACEHOLDER" : "SET";
  }, "MISSING");

  if (state !== "SET") missing += 1;
  rows.push(`  ${state.padEnd(11)}  ${entry.name.padEnd(24)} ${entry.what}`);
}

process.stdout.write(
  [
    "Render pipeline environment — SET / MISSING only",
    "",
    ...rows,
    "",
    missing === 0
      ? "  All required variables carry a real value."
      : `  ${missing} required variable(s) unusable in this environment.`,
    missing === 0
      ? ""
      : "  PLACEHOLDER means the name exists but the value is a sentinel, not a secret.",
    "",
  ].join("\n")
);

process.exit(missing === 0 ? 0 : 1);
