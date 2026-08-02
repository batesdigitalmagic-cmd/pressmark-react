/*
 * Folder-tree verification.
 *
 *   npm run verify:tree                      dry run — prints every tree, no API calls
 *   npm run verify:tree -- --live --type=yearbook   creates one [TEST] project in WorkDrive
 *   npm run verify:tree -- --live --all      creates a [TEST] project for every type
 *
 * Dry run is the default on purpose: --all against a live account creates
 * roughly 350 folders. Nothing is ever deleted — clean up by hand.
 */

import {
  CLIENT_UPLOAD_FOLDER,
  SERVICE_TREES,
  UNIVERSAL_FOLDERS,
  PUBLICATION_TYPE_ALIASES,
  createFolderTree,
  createWorkDriveFolder,
  normalizePublicationType,
} from "../lib/workdrive.js";

const args = process.argv.slice(2);
const live = args.includes("--live");
const all = args.includes("--all");
const only = args.find((a) => a.startsWith("--type="))?.split("=")[1];

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/* Every value the form can submit today, plus the two the spec defines but the
   form does not yet offer. */
const FORM_VALUES = [
  "School Yearbook",
  "Church Directory",
  "Association Directory",
  "Government Publication",
  "Annual Report",
  "Program / Event Book",
  "Data Merge",
  "Publication Cleanup",
  "Other / Not Sure",
  "Newsletter",
  "Print-Ready PDF",
];

function renderTree(publicationType) {
  const key = normalizePublicationType(publicationType);
  const service = key ? SERVICE_TREES[key] : null;

  console.log(
    `\n${c.bold(publicationType)} ${c.dim("→")} ${key ? c.green(key) : c.yellow("universal only")}`
  );

  let total = 0;
  for (const folder of UNIVERSAL_FOLDERS) {
    const children = service?.[folder] || [];
    const marker = folder === CLIENT_UPLOAD_FOLDER ? c.green(" ← upload link") : "";
    console.log(`  ${folder}${marker}`);
    total += 1;
    children.forEach((child, i) => {
      console.log(`  ${i === children.length - 1 ? "└──" : "├──"} ${child}`);
      total += 1;
    });
  }
  console.log(c.dim(`  ${total} folders`));
  return total;
}

if (!live) {
  console.log(c.bold("\nDry run — no API calls. Pass --live to create folders.\n"));
  console.log(c.bold("Alias resolution"));
  for (const value of FORM_VALUES) {
    const key = normalizePublicationType(value);
    console.log(`  ${value.padEnd(24)} → ${key ? c.green(key) : c.yellow("(universal only)")}`);
  }

  console.log(`\n${c.bold("Case and separator handling")}`);
  for (const variant of ["church-directory", "Church Directory", "CHURCH_DIRECTORY", "church   directory"]) {
    const key = normalizePublicationType(variant);
    const ok = key === "directory";
    console.log(`  ${ok ? c.green("✓") : c.red("✗")} ${variant.padEnd(24)} → ${key}`);
  }

  let grand = 0;
  for (const value of FORM_VALUES) grand += renderTree(value);

  console.log(`\n${c.dim(`${Object.keys(SERVICE_TREES).length} service trees defined`)}`);
  console.log(c.dim(`${Object.keys(PUBLICATION_TYPE_ALIASES).length} aliases mapped`));
  console.log(c.dim(`${grand} folders across all types if every one were created\n`));
  process.exit(0);
}

// ── live mode ──
const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_WORKDRIVE_PARENT_FOLDER_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.log(`\n${c.red("Missing environment variables:")} ${missing.join(", ")}\n`);
  process.exit(1);
}

if (!only && !all) {
  console.log(`\n${c.red("Specify --type=<value> or --all.")}`);
  console.log(c.dim("--all creates roughly 350 folders. Start with one type.\n"));
  process.exit(1);
}

const { getAccessToken } = await import("../api/quote.js");
const targets = only ? [only] : FORM_VALUES;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

console.log(`\n${c.yellow("LIVE")} — creating ${targets.length} [TEST] project folder(s). Nothing is deleted.\n`);

const token = await getAccessToken();

for (const publicationType of targets) {
  const name = `[TEST] ${publicationType} ${stamp}`;
  try {
    const root = await createWorkDriveFolder(token, name);
    const summary = await createFolderTree(token, root.id, publicationType);

    const status = summary.failed.length ? c.red(`${summary.failed.length} failed`) : c.green("ok");
    console.log(`${c.bold(publicationType)} ${c.dim(`→ ${summary.treeKey || "universal only"}`)}  ${status}`);
    console.log(c.dim(`  root    ${root.id}  ${root.url}`));
    console.log(c.dim(`  created ${summary.created.length}   reused ${summary.reused.length}`));

    const uploads = summary.folders[CLIENT_UPLOAD_FOLDER];
    console.log(c.dim(`  uploads ${uploads || c.red("MISSING — no link would be issued")}`));

    for (const failure of summary.failed) {
      console.log(c.red(`  ✗ ${failure.path}: ${failure.error}`));
    }
  } catch (error) {
    console.log(`${c.red("✗")} ${publicationType}: ${error.message}`);
  }
}

console.log(c.dim("\nDelete the [TEST] folders in WorkDrive when you're done.\n"));
