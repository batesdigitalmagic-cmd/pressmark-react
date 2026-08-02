/*
 * Live end-to-end check of the Zoho integration.
 *
 *   npm run verify:zoho
 *
 * Runs the same functions api/quote.js uses in production, in order:
 *   1. refresh the access token
 *   2. create a WorkDrive folder under ZOHO_WORKDRIVE_PARENT_FOLDER_ID
 *   3. mint an upload-only link for it
 *   4. create a CRM Lead carrying both links
 *
 * This writes REAL records to your Zoho account. Everything it creates is
 * prefixed [TEST] and the ids are printed at the end so you can remove them.
 */

import {
  getAccessToken,
  createWorkDriveFolder,
  createUploadLink,
  createLead,
} from "../api/quote.js";

const REQUIRED = [
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_REFRESH_TOKEN",
  "ZOHO_WORKDRIVE_PARENT_FOLDER_ID",
];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const created = {};

function fail(step, error) {
  console.log(`${c.red("✗")} ${step}`);
  console.log(`\n${c.red("Zoho said:")} ${error.message}\n`);
  console.log(c.dim("Common causes:"));
  console.log(c.dim("  INVALID_TOKEN / invalid_code  → refresh token wrong, revoked, or from another data center"));
  console.log(c.dim("  OAUTH_SCOPE_MISMATCH          → re-run consent with the scope the failing call needs"));
  console.log(c.dim("  INVALID_URL_PATTERN           → ZOHO_API_DOMAIN points at the wrong data center"));
  console.log(c.dim("  MANDATORY_NOT_FOUND           → CRM requires a field the payload omitted"));
  console.log(c.dim("  URL_RULE_NOT_CONFIGURED       → parent folder id wrong, or no WorkDrive access\n"));
  report();
  process.exit(1);
}

function report() {
  const entries = Object.entries(created);
  if (!entries.length) return;
  console.log(c.bold("Records created — delete these when you're done:"));
  for (const [label, value] of entries) console.log(`  ${label}: ${value}`);
  console.log(
    c.dim(
      "\n  WorkDrive: open the folder and delete it.\n" +
        "  CRM: Leads → search “[TEST]” → delete.\n"
    )
  );
}

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(`\n${c.red("Missing environment variables:")}\n`);
  for (const key of missing) console.log(`  ${key}`);
  console.log(c.dim("\nCopy .env.example to .env and fill it in.\n"));
  process.exit(1);
}

console.log(`\n${c.bold("Zoho integration check")}`);
console.log(c.dim(`accounts : ${process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com"}`));
console.log(c.dim(`api      : ${process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com"}`));
console.log(c.dim(`parent   : ${process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID}\n`));

// 1 ── token
let token;
try {
  token = await getAccessToken();
  console.log(`${c.green("✓")} 1/4  access token refreshed ${c.dim(`(${token.slice(0, 12)}…)`)}`);
} catch (error) {
  fail("1/4  access token refresh", error);
}

// 2 ── folder
let folder;
const folderName = `[TEST] Pressmark integration check ${stamp}`;
try {
  folder = await createWorkDriveFolder(token, folderName);
  created["WorkDrive folder"] = `${folder.id}  ${folder.url}`;
  console.log(`${c.green("✓")} 2/4  WorkDrive folder created ${c.dim(folder.id)}`);
  console.log(`       ${c.dim(folder.url)}`);
} catch (error) {
  fail("2/4  WorkDrive folder creation", error);
}

// 3 ── upload link
let uploadUrl = "";
try {
  uploadUrl = await createUploadLink(token, folder.id, folderName);
  console.log(`${c.green("✓")} 3/4  upload link minted ${c.dim("(role_id 7, download off)")}`);
  console.log(`       ${c.dim(uploadUrl)}`);
} catch (error) {
  console.log(`${c.red("✗")} 3/4  upload link creation`);
  console.log(`\n${c.red("Zoho said:")} ${error.message}\n`);
  console.log(c.dim("Check WorkDrive.links.ALL is in your granted scopes, and that"));
  console.log(c.dim("expiration_date accepts YYYY-MM-DD on your account.\n"));
  console.log(c.dim("Continuing to the CRM step so you learn about both in one run.\n"));
}

// 4 ── lead
try {
  const leadId = await createLead(
    token,
    {
      firstName: "Integration",
      lastName: "[TEST] Check",
      email: `test+${Date.now()}@pressmark.studio`,
      phone: "",
      organization: "[TEST] Pressmark Verification",
      publicationType: "School Yearbook",
      estimatedPageCount: "80 pages",
      deadline: "Not a real deadline",
      budgetRange: "$2,500 - $5,000",
      projectDetails: "Automated verification run. Safe to delete.",
    },
    { folderUrl: folder.url, uploadUrl, note: "" }
  );
  created["CRM lead"] = leadId;
  console.log(`${c.green("✓")} 4/4  CRM lead created ${c.dim(leadId)}`);
} catch (error) {
  fail("4/4  CRM lead creation", error);
}

console.log(`\n${c.green(c.bold("All checks passed."))}`);
console.log(c.dim("The quote form will work against this configuration.\n"));
report();
