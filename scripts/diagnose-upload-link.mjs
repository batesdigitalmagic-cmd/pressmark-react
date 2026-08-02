/*
 * Isolates why POST /workdrive/api/v1/links fails.
 *
 *   npm run diagnose:link                 creates a [TEST] folder, then probes
 *   npm run diagnose:link -- --folder=ID  probes an existing folder
 *
 * Each probe changes exactly one variable, so the pass/fail pattern points at
 * the cause: endpoint host, OAuth scope, folder permissions, or payload.
 * Creates at most one folder. Deletes nothing. Changes no production code.
 */

import { createWorkDriveFolder } from "../lib/workdrive.js";
import { getAccessToken } from "../api/quote.js";

const API_DOMAIN = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
const WORKDRIVE_DOMAIN = process.env.ZOHO_WORKDRIVE_DOMAIN || "https://workdrive.zoho.com";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.log(`\n${c.red("Missing:")} ${missing.join(", ")}\n`);
  process.exit(1);
}

const folderArg = process.argv.find((a) => a.startsWith("--folder="))?.split("=")[1];

const token = await getAccessToken();
console.log(c.green("\n✓ access token obtained") + c.dim(" — refresh token and client credentials are valid"));

let folderId = folderArg;
if (!folderId) {
  if (!process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID) {
    console.log(`\n${c.red("Set ZOHO_WORKDRIVE_PARENT_FOLDER_ID or pass --folder=ID")}\n`);
    process.exit(1);
  }
  const f = await createWorkDriveFolder(token, `[TEST] link diagnosis ${Date.now()}`);
  folderId = f.id;
  console.log(c.green("✓ test folder created") + c.dim(` ${folderId} — WorkDrive.files write scope works`));
}

const expiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

async function probe(label, { url, attributes, method = "POST" }) {
  const body = attributes ? JSON.stringify({ data: { type: "links", attributes } }) : undefined;
  let res, raw;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        Accept: "application/vnd.api+json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
    });
    raw = await res.text();
  } catch (error) {
    console.log(`\n${c.red("✗")} ${c.bold(label)}\n  network error: ${error.message}`);
    return null;
  }

  const ok = res.ok;
  console.log(`\n${ok ? c.green("✓") : c.red("✗")} ${c.bold(label)}`);
  console.log(c.dim(`  ${method} ${url}`));
  if (attributes) console.log(c.dim(`  payload  ${JSON.stringify(attributes)}`));
  console.log(c.dim(`  status   ${res.status} ${res.statusText}`));
  console.log(c.dim(`  type     ${res.headers.get("content-type")}`));
  console.log(`  body     ${raw.slice(0, 400) || c.dim("(empty)")}`);
  return { status: res.status, raw, ok };
}

const full = {
  resource_id: folderId,
  link_name: "Diagnostic upload link",
  role_id: "7",
  allow_download: false,
  request_user_data: false,
  expiration_date: expiry,
};

console.log(c.bold("\n─── probes ───"));

// A: exactly what production sends
const a = await probe("A  production payload, zohoapis.com host", {
  url: `${API_DOMAIN}/workdrive/api/v1/links`,
  attributes: full,
});

// B: same payload, workdrive.zoho.com host → isolates the endpoint host
const b = await probe("B  same payload, workdrive.zoho.com host", {
  url: `${WORKDRIVE_DOMAIN}/api/v1/links`,
  attributes: full,
});

// C: drop expiration_date → isolates date format
const { expiration_date, ...noExpiry } = full;
const cProbe = await probe("C  no expiration_date", {
  url: `${API_DOMAIN}/workdrive/api/v1/links`,
  attributes: noExpiry,
});

// D: role_id 6 (VIEW) → isolates whether role 7 specifically is rejected
const d = await probe("D  role_id 6 (view) instead of 7 (upload)", {
  url: `${API_DOMAIN}/workdrive/api/v1/links`,
  attributes: { ...noExpiry, role_id: "6" },
});

// E: minimal payload → isolates optional attributes
const e = await probe("E  minimal payload (resource_id + role_id only)", {
  url: `${API_DOMAIN}/workdrive/api/v1/links`,
  attributes: { resource_id: folderId, role_id: "7" },
});

// F: read links → isolates scope from write permission
const f = await probe("F  GET links (read access)", {
  url: `${API_DOMAIN}/workdrive/api/v1/files/${folderId}/links`,
  method: "GET",
});

console.log(c.bold("\n─── reading the results ───\n"));
const any = [a, b, cProbe, d, e].some((r) => r?.ok);

if (a?.ok) {
  console.log(c.green("Probe A passed — production payload works. The earlier failure was transient,"));
  console.log(c.green("or the folder in the failing run differed from this one."));
} else if (b?.ok) {
  console.log(c.yellow("ENDPOINT HOST. /links is not served on zohoapis.com for your account;"));
  console.log(c.yellow("workdrive.zoho.com works. Fix: point link creation at ZOHO_WORKDRIVE_DOMAIN."));
} else if (cProbe?.ok || e?.ok) {
  console.log(c.yellow("PAYLOAD. Removing expiration_date fixed it — the date format is rejected."));
  console.log(c.yellow("Fix: drop it, or send the format Zoho expects (try MM/dd/yyyy)."));
} else if (d?.ok) {
  console.log(c.yellow("ROLE. role_id 6 works but 7 does not — 7 is not UPLOAD on your account,"));
  console.log(c.yellow("or upload links require a Team Folder rather than My Folders."));
} else if (!any && f?.status === 401) {
  console.log(c.red("OAUTH SCOPE. Even reading links is unauthorized."));
  console.log(c.red("Re-run /api/auth/zoho/start — link scope is missing from your token."));
} else if (!any && [403, 400].includes(a?.status)) {
  console.log(c.red("PERMISSIONS or SCOPE. Folder writes succeed but link creation is refused."));
  console.log(c.red("Check: (1) token includes a WorkDrive links scope, (2) external sharing is"));
  console.log(c.red("enabled for your org, (3) the folder sits in a Team Folder you can share."));
} else if (!any && a?.status === 404) {
  console.log(c.red("ENDPOINT. Both hosts 404 — the path or API version is wrong for your account."));
} else {
  console.log(c.yellow("No clean signal. Compare the status codes and bodies above."));
}

console.log(c.dim("\nFolder used: " + folderId + " — delete it by hand when finished.\n"));
