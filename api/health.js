/*
 * Configuration health check.
 *
 *   GET /api/health
 *
 * Reports ONLY whether each variable is present. It never returns a value, a
 * length, a prefix, a hash, or any other derivative — a boolean is the entire
 * output. Nothing here can leak a secret even if the response is public.
 *
 * It also does not connect to Stripe, Redis, or Zoho: presence of config is a
 * different question from reachability of a service, and conflating them makes
 * a slow third party look like a misconfiguration.
 */

export const config = { runtime: "edge" };

/* Groups map to features, so a missing variable points at what breaks rather
   than just what's absent. */
const GROUPS = {
  checkout: {
    label: "Stripe checkout",
    required: ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"],
    optional: ["STRIPE_TAX"],
  },
  webhooks: {
    label: "Stripe webhooks (key issuance, refund revocation)",
    required: ["STRIPE_WEBHOOK_SECRET"],
    optional: [],
  },
  licenseStore: {
    label: "License storage",
    // Either the Vercel names or the Upstash-native ones satisfy this.
    required: [],
    optional: [
      "KV_REST_API_URL",
      "KV_REST_API_TOKEN",
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
    ],
  },
  portal: {
    label: "License portal sign-in",
    required: ["PORTAL_SESSION_SECRET"],
    optional: [],
  },
  downloads: {
    label: "Installer downloads",
    required: ["DOWNLOAD_URL_1_0_0"],
    optional: ["CURRENT_VERSION"],
  },
  quoteForm: {
    label: "Quote form (Zoho CRM, WorkDrive, Mail)",
    required: [
      "ZOHO_CLIENT_ID",
      "ZOHO_CLIENT_SECRET",
      "ZOHO_REFRESH_TOKEN",
      "ZOHO_WORKDRIVE_PARENT_FOLDER_ID",
    ],
    optional: ["ZOHO_MAIL_FROM_ADDRESS", "ZOHO_API_DOMAIN", "ZOHO_ACCOUNTS_DOMAIN"],
  },
};

/* Presence only. Whitespace counts as absent — a variable set to " " in a
   dashboard is a misconfiguration, not a value. */
const isSet = (name) => Boolean((process.env[name] || "").trim());

export default async function handler(request) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const groups = {};
  const missing = [];

  for (const [id, group] of Object.entries(GROUPS)) {
    const variables = {};
    for (const name of [...group.required, ...group.optional]) {
      variables[name] = isSet(name);
    }

    const absent = group.required.filter((name) => !isSet(name));
    missing.push(...absent);

    groups[id] = {
      label: group.label,
      ready: absent.length === 0,
      variables,
    };
  }

  /* Storage is satisfied by either naming convention, so it needs its own
     rule rather than a plain required-list check. */
  const hasVercelKv = isSet("KV_REST_API_URL") && isSet("KV_REST_API_TOKEN");
  const hasUpstash = isSet("UPSTASH_REDIS_REST_URL") && isSet("UPSTASH_REDIS_REST_TOKEN");
  const hasRemoteLicenseServer = isSet("LICENSE_API_URL") && isSet("LICENSE_ADMIN_TOKEN");

  groups.licenseStore.ready = hasVercelKv || hasUpstash || hasRemoteLicenseServer;
  groups.licenseStore.backend = hasRemoteLicenseServer
    ? "remote license server"
    : hasVercelKv
      ? "Vercel KV (KV_REST_API_*)"
      : hasUpstash
        ? "Upstash (UPSTASH_REDIS_REST_*)"
        : "not configured";

  if (!groups.licenseStore.ready) {
    missing.push("KV_REST_API_URL + KV_REST_API_TOKEN");
  }

  const ready = Object.values(groups).every((group) => group.ready);

  return json(
    {
      ok: ready,
      checkedAt: new Date().toISOString(),
      note: "Presence only. No values, lengths, or prefixes are ever returned.",
      groups,
      missingRequired: missing,
    },
    ready ? 200 : 503
  );
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
