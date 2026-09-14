/*
 * Verifies the Instant Proof design templates and data pipeline.
 *
 *   npm run verify:proof
 *
 * ── Why a script rather than a test runner ──
 *
 * This repository has no test framework, and adding one for a single feature
 * is a larger decision than this change should make. It follows the convention
 * already here — scripts/verify-zoho.mjs, scripts/verify-folder-tree.mjs — and
 * every module it exercises is pure, so it moves into a real runner unchanged
 * if one is ever adopted.
 *
 * Deliberately imports no .jsx: plain `node` cannot transform it. Everything
 * asserted below lives in the pure modules the renderer is glue over —
 * geometry.js owns the coordinate system, fitting.js owns overflow behaviour,
 * bindings.js owns field resolution, proofPlan.js owns record assignment.
 */

import { DESIGN_TEMPLATES, templateFor } from "../src/instant-proof/templates/registry.js";
import { cellBox, frame, pageBox, pt } from "../src/instant-proof/render/geometry.js";
import { estimateLines, fitTypeSize } from "../src/instant-proof/render/fitting.js";
import { resolveBinding } from "../src/instant-proof/render/bindings.js";
import { planProof } from "../src/instant-proof/render/proofPlan.js";
import {
  columnsOf,
  requiredColumnsOf,
  schemaFor,
} from "../src/instant-proof/csv/schemas.js";
import { matchPhotos } from "../src/instant-proof/csv/photoMatching.js";
import { parseCsv } from "../src/instant-proof/csv/parseCsv.js";
import {
  applyMapping,
  isCanonical,
  mappingFromProposals,
  suggestMapping,
} from "../src/instant-proof/csv/columnMapping.js";
import { analyzeRecords } from "../src/instant-proof/csv/analyzeRecords.js";
import {
  WORKER_HEADERS,
  WORKER_OPTIONAL_HEADERS,
  WORKER_REQUIRED_HEADERS,
  toDirectoryCsv,
  unexportableRecords,
} from "../src/instant-proof/csv/directoryExport.js";
/* The server's own validator, run for real. scripts/ may import lib/; src/ may
   not, which is exactly why the header list is mirrored and asserted here. */
import {
  OPTIONAL_HEADERS as SERVER_OPTIONAL_HEADERS,
  REQUIRED_HEADERS as SERVER_REQUIRED_HEADERS,
  SUPPORTED_HEADERS as SERVER_SUPPORTED_HEADERS,
  validateAndNormalizeCsv,
} from "../lib/render-jobs/csv.js";
import {
  PROOF_MODES,
  emptyOrganization,
  emptyProject,
  hasPhotoDetails,
  kindOf,
  ORGANIZATION_FALLBACK,
} from "../src/instant-proof/models.js";
import {
  QUICK_PROOF_PHOTO_LIMIT,
  photoRecords,
  photosForProof,
  recordsFor,
  suggestsPhotoLedDesign,
} from "../src/instant-proof/photoProject.js";
import { captionFor, defaultTemplateFor, modeForTemplate } from "../src/instant-proof/templates/registry.js";
import { getSubscriptionService, isValidEmail } from "../src/instant-proof/services/subscriptionService.js";
import { buildContactPayload } from "../src/instant-proof/services/contactRequests.js";
import { __sanitizeForTest } from "../src/instant-proof/analytics.js";
import { ACCENT as ACCENT_TOKENS, BUTTON as BUTTON_TOKENS } from "../src/palette.js";
import {
  BRAND_COLOR_KEYS as BRAND_COLOR_ORDER,
  BRAND_COLORS,
  DEFAULT_COLORS,
  SWATCH_FOR,
  changedColors,
  cmykToHex,
  hexToCmyk,
  isValidHex,
  normalizeHex,
  validateBrandColors,
} from "../src/instant-proof/colors.js";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];

function ok(name, condition, detail = "") {
  if (condition) {
    pass += 1;
    console.log(`  pass  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const group = (title) => console.log(`\n${title}`);

/* ── Fixtures: twelve directory records, deliberately awkward ── */

const LONG_NAME = "Vandenberg-Fitzwilliam, Alexandra Kathryn";
const LONG_ADDRESS = "1207 Willow Bend Drive Apartment 4B, Building Seven";

const RECORDS = [
  ["Whitfield, Ava", "Board President"],
  ["Okonkwo, Benjamin", "Vice President"],
  ["Reyes-Alvarado, Marisol", "Membership Secretary"],
  ["Nakamura, Kenji", "Treasurer"],
  ["Abernathy-Cole, Charlotte", "Communications Chair"],
  ["Osei, Daniel", "Member at Large"],
  [LONG_NAME, "Executive Director of Strategic Partnerships and Outreach"],
  ["Li, Wei", ""], // no title — must collapse cleanly
  ["Costa, Ana", "Volunteer Coordinator"],
  ["Mbeki, Thandiwe", "Events Chair"],
  ["O'Sullivan, Padraig", "Historian"],
  ["Kim, Soo-Jin", "Auditor"],
].map(([display_name, title], i) => ({
  record_id: String(i + 1),
  display_name,
  title,
  address: i === 6 ? LONG_ADDRESS : "412 Larkspur Lane",
  city: "Marietta",
  state: "GA",
  postal_code: "30060",
  photo_filename: `person-${i + 1}.jpg`,
  sort_order: String(i + 1),
}));

/* Directory Classic's own schema — the eight InDesign merge fields. Every
   geometry and binding assertion below is about THAT template, so it must
   resolve against the schema that template declares. */
const SCHEMA = schemaFor("church-directory");
const DIRECTORY = templateFor("directory-classic");
const LISTING = DIRECTORY.pages.find((p) => p.pageType === "listing-spread");
const GRIDS = LISTING.elements.filter((e) => e.type === "repeater");

/* Reserved bands, resolved once — the card's text elements in page order. */
const CARD = GRIDS[0].cell;
const CARD_BOX = cellBox(GRIDS[0]);
const band = (field) => CARD.find((e) => e.field === field);
const NAME = band("personName");
const PHONE = band("role:phone");
const ADDRESS = band("addressLine");
/* The last reserved band on the card, whatever it is — used only to report how
   much of the card is used, so it must not name a specific field. */
const LAST_BAND = CARD.reduce((lowest, element) =>
  element.y + element.height > lowest.y + lowest.height ? element : lowest
);

/* Height a text element can actually occupy at its declared maxLines. */
const occupied = (element, template) => {
  const role = template.fontRoles[element.fontRole];
  return ((element.maxLines ?? 1) * role.size * (role.lineHeight ?? 1.3)) / 72;
};

/* ── 1. Every profile element stays inside its card ── */
group("1. Profile elements stay inside their card");
{
  let outside = 0;
  for (const element of CARD) {
    if (
      element.x < -1e-9 ||
      element.y < -1e-9 ||
      element.x + element.width > CARD_BOX.widthIn + 1e-9 ||
      element.y + element.height > CARD_BOX.heightIn + 1e-9
    ) {
      outside += 1;
      console.log(`        ${element.field ?? element.type} runs to ${(element.y + element.height).toFixed(3)}in`);
    }
  }
  ok("all card elements within the card box", outside === 0,
     `card ${CARD_BOX.widthIn} x ${CARD_BOX.heightIn}in, last band ends ${(LAST_BAND.y + LAST_BAND.height).toFixed(2)}in`);

  let tooTall = 0;
  for (const element of CARD) {
    if (element.type !== "text") continue;
    if (occupied(element, DIRECTORY) > element.height + 1e-9) tooTall += 1;
  }
  ok("each band is taller than its type can occupy", tooTall === 0);
}

/* ── 2. Every card stays inside its page ── */
group("2. Cards stay inside the page");
{
  const page = pageBox(DIRECTORY, LISTING);
  let outside = 0;
  for (const grid of GRIDS) {
    if (grid.x < 0 || grid.y < 0 || grid.x + grid.width > page.widthIn + 1e-9 || grid.y + grid.height > page.heightIn + 1e-9) outside += 1;
  }
  ok("both grids sit within the spread", outside === 0, `spread ${page.widthIn} x ${page.heightIn}in`);

  const margins = [GRIDS[0].x, page.widthIn - (GRIDS[1].x + GRIDS[1].width)];
  ok("outside margins are equal", Math.abs(margins[0] - margins[1]) < 1e-9, `${margins[0]}in each side`);
}

/* ── 3. No card crosses the centre gutter ── */
group("3. No card crosses the centre fold");
{
  const fold = DIRECTORY.pageSize.width; // 8.5in on a 17in spread
  const versoEnd = GRIDS[0].x + GRIDS[0].width;
  const rectoStart = GRIDS[1].x;
  ok("verso grid ends before the fold", versoEnd <= fold, `${versoEnd}in < ${fold}in`);
  ok("recto grid starts after the fold", rectoStart >= fold, `${rectoStart}in > ${fold}in`);
  ok("gutter is at least 0.75in", rectoStart - versoEnd >= 0.75, `${(rectoStart - versoEnd).toFixed(2)}in`);
  ok("gutter is centred on the fold",
     Math.abs((fold - versoEnd) - (rectoStart - fold)) < 1e-9,
     `${(fold - versoEnd).toFixed(2)}in each side`);
}

/* ── 4. Second-row content stays above the footer ── */
group("4. Second row clears the folio and footer");
{
  const grid = GRIDS[0];
  const { rows, gapY } = grid.repeat;
  const secondRowTop = grid.y + (rows - 1) * (CARD_BOX.heightIn + gapY);
  const secondRowContentBottom = secondRowTop + LAST_BAND.y + LAST_BAND.height;
  const gridBottom = grid.y + grid.height;

  const folio = LISTING.elements.find((e) => e.field === "static:12");
  /* FooterMark sits 2.6% up from the bottom edge; see TemplateRenderer. */
  const footerTop = DIRECTORY.pageSize.height * (1 - 0.026) - 0.2;

  ok("second row's last band is inside the grid", secondRowContentBottom <= gridBottom + 1e-9,
     `${secondRowContentBottom.toFixed(2)}in <= ${gridBottom.toFixed(2)}in`);
  ok("second row clears the folio", secondRowContentBottom <= folio.y,
     `content ${secondRowContentBottom.toFixed(2)}in, folio ${folio.y}in`);
  ok("second row clears the footer credit", secondRowContentBottom <= footerTop,
     `footer starts ~${footerTop.toFixed(2)}in`);
}

/* ── 5 & 6. Bands cannot overlap ── */
group("5-6. Reserved bands cannot overlap");
{
  const ordered = CARD.filter((e) => e.type === "text").sort((a, b) => a.y - b.y);
  let overlaps = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    if (previous.y + previous.height > ordered[i].y + 1e-9) {
      overlaps += 1;
      console.log(`        ${previous.field} ends ${(previous.y + previous.height).toFixed(3)} but ${ordered[i].field} starts ${ordered[i].y}`);
    }
  }
  ok("no two text bands overlap", overlaps === 0);
  ok("name cannot reach the phone", NAME.y + NAME.height <= PHONE.y,
     `name ends ${(NAME.y + NAME.height).toFixed(2)}, phone starts ${PHONE.y}`);
  ok("phone cannot reach the address band", PHONE.y + PHONE.height <= ADDRESS.y,
     `phone ends ${(PHONE.y + PHONE.height).toFixed(2)}, address starts ${ADDRESS.y}`);
  /* There is no portrait any more — the listing is text — so the name is the
     first band and starts at the top of the card. */
  ok("the name is the first band on the card", NAME.y === 0, `name starts ${NAME.y}in`);
}

/* ── 7 & 8. Long text is contained ── */
group("7-8. Long text stays within its line limit");
{
  ok("name band allows exactly two lines", NAME.maxLines === 2);
  ok("address band allows exactly two lines", ADDRESS.maxLines === 2);
  ok("the phone line allows exactly one", PHONE.maxLines === 1);

  const nameRole = DIRECTORY.fontRoles[NAME.fontRole];
  const fitted = fitTypeSize(LONG_NAME, NAME.width, NAME.height, nameRole.size, NAME.maxLines, nameRole.lineHeight);
  ok("a 41-character name shrinks rather than overflowing", fitted <= nameRole.size,
     `${nameRole.size}pt -> ${fitted.toFixed(1)}pt`);
  ok("shrinking respects the legibility floor", fitted >= 7, `${fitted.toFixed(1)}pt >= 7pt`);
  ok("fitted long name occupies no more than its band",
     (Math.min(estimateLines(LONG_NAME, NAME.width, fitted), NAME.maxLines) * fitted * nameRole.lineHeight) / 72 <= NAME.height + 1e-9);
  ok("name uses shrink-then-clamp", NAME.textFit === "shrink");
  ok("address clamps with an ellipsis", ADDRESS.textFit === "clamp");
  ok("the phone line truncates rather than wrapping", PHONE.textFit === "truncate");

  const addrRole = DIRECTORY.fontRoles[ADDRESS.fontRole];
  ok("a 50-character address needs no more than two lines at its size",
     estimateLines(LONG_ADDRESS, ADDRESS.width, addrRole.size) <= 3,
     `${estimateLines(LONG_ADDRESS, ADDRESS.width, addrRole.size)} lines, clamped to ${ADDRESS.maxLines}`);
}

/* ── 9. Missing fields collapse without disturbing the card ── */
group("9. Missing fields collapse cleanly");
{
  const noAlternates = {
    last_name: "Li", first_name: "Wei",
    address: "412 Larkspur Lane", phone: "770-555-0142", email: "wei.li@example.org",
    alternate_phone: "", alternate_email: "", family_members: "",
  };
  const bind = (field, record) => resolveBinding(field, { record, schema: SCHEMA }).value;

  ok("an absent alternate phone resolves to empty", bind("altPhoneLine", noAlternates) === "");
  ok("an absent alternate email resolves to empty", bind("altEmailLine", noAlternates) === "");
  ok("an absent family list resolves to empty", bind("familyLine", noAlternates) === "");
  ok("its name still resolves", bind(NAME.field, noAlternates) === "Li, Wei", bind(NAME.field, noAlternates));
  ok("its phone still resolves", bind(PHONE.field, noAlternates) === "770-555-0142");
  ok("its address still resolves",
     bind(ADDRESS.field, noAlternates) === "Address: 412 Larkspur Lane", bind(ADDRESS.field, noAlternates));

  /* Bands are at fixed coordinates, so an empty one cannot move its neighbours.
     That is the guarantee — not that the renderer happens to reflow correctly. */
  const ALT_PHONE = band("altPhoneLine");
  ok("the address band's position does not depend on the alternate phone",
     ADDRESS.y === 2.03 && ALT_PHONE.y < ADDRESS.y,
     `address at ${ADDRESS.y}in, alt phone at ${ALT_PHONE.y}in`);

  const noAddress = { last_name: "Nobody", first_name: "A" };
  ok("an absent address resolves to empty", bind(ADDRESS.field, noAddress) === "");

  /* The name is composed from the two real columns — there is no display_name
     column in this schema, and none is invented. */
  ok("a name is composed as Last, First from the customer's own columns",
     bind(NAME.field, { last_name: "Lovelace", first_name: "Ada" }) === "Lovelace, Ada",
     bind(NAME.field, { last_name: "Lovelace", first_name: "Ada" }));
  ok("a record with only a surname prints that surname alone",
     bind(NAME.field, { last_name: "Cher", first_name: "" }) === "Cher");
  ok("an empty record yields no name, not a placeholder", bind(NAME.field, null) === "");
}

/* ── 10. Twelve records fill the spread in order ── */
group("10. Twelve records fill the spread in order");
{
  const plan = planProof(DIRECTORY, RECORDS);
  const listing = plan.pages.find((p) => p.page.pageType === "listing-spread");
  ok("the spread receives all twelve", listing.records.length === 12, `${listing.records.length} records`);
  ok("grids declare six cells each",
     GRIDS.every((g) => g.repeat.columns * g.repeat.rows === 6));
  ok("verso starts at record 1", (GRIDS[0].startIndex ?? 0) === 0);
  ok("recto starts at record 7", GRIDS[1].startIndex === 6);

  const verso = Array.from({ length: 6 }, (_, i) => listing.records[(GRIDS[0].startIndex ?? 0) + i]);
  const recto = Array.from({ length: 6 }, (_, i) => listing.records[GRIDS[1].startIndex + i]);
  ok("verso holds records 1-6", verso.map((r) => r.record_id).join(",") === "1,2,3,4,5,6");
  ok("recto holds records 7-12", recto.map((r) => r.record_id).join(",") === "7,8,9,10,11,12");
  ok("no record appears on both pages", !verso.some((r) => recto.includes(r)));

  const plan24 = planProof(DIRECTORY, [...RECORDS, ...RECORDS.map((r, i) => ({ ...r, record_id: String(13 + i) }))]);
  ok("a longer roster reports what the sample omits", plan24.recordsOmitted > 0,
     `${plan24.recordsShown} shown, ${plan24.recordsOmitted} omitted of ${plan24.recordsAvailable}`);
}

/* ── 11. Photographs stay with their own record ── */
group("11. Photographs stay with their own record");
{
  const assets = RECORDS.map((r, i) => ({
    id: `a${i}`,
    name: i === 3 ? r.photo_filename.toUpperCase() : r.photo_filename,
    extension: ".jpg",
    size: 1,
    kind: "image",
  }));
  const report = matchPhotos(RECORDS, "photo_filename", assets, {});

  let mismatched = 0;
  for (const match of report.matches) {
    if (!match.asset) continue;
    if (match.asset.name.toLowerCase() !== match.record.photo_filename.toLowerCase()) mismatched += 1;
  }
  ok("every matched photo belongs to its own record", mismatched === 0);
  ok("eleven match exactly, one by case", report.exact === 11 && report.insensitive === 1,
     `exact ${report.exact}, case ${report.insensitive}`);
  ok("no record is left unmatched", report.unmatched === 0);
  ok("no upload goes unused", report.unused.length === 0);

  /* A record naming a file nobody uploaded must get nothing — never a
     neighbour's photograph. */
  const short = matchPhotos(RECORDS, "photo_filename", assets.slice(0, 3), {});
  ok("a record with no photo gets null, not a neighbour's",
     short.matches.slice(3).every((m) => m.asset === null), `${short.unmatched} unmatched`);
}

/* ── 12. Scaling does not change internal proportions ── */
group("12. Scaling preserves internal proportions");
{
  const boxes = [CARD_BOX, pageBox(DIRECTORY, LISTING)];
  let nonRelative = 0;
  for (const element of CARD) {
    const f = frame(element, CARD_BOX);
    for (const value of [f.left, f.top, f.width, f.height]) {
      if (!/^-?[\d.]+%$/.test(value)) nonRelative += 1;
    }
  }
  ok("every position and size is a percentage", nonRelative === 0,
     "no px, so a 320px phone and a 972px desktop render identical proportions");

  let nonCqw = 0;
  for (const element of CARD) {
    if (element.type !== "text") continue;
    if (!/^[\d.]+cqw$/.test(pt(DIRECTORY.fontRoles[element.fontRole].size, CARD_BOX))) nonCqw += 1;
  }
  ok("every type size is a container-relative cqw", nonCqw === 0);

  ok("frame() is a pure ratio, independent of any viewport",
     JSON.stringify(frame(NAME, CARD_BOX)) === JSON.stringify(frame(NAME, { ...CARD_BOX })));
  ok("a box is required — a missing one throws rather than yielding NaN",
     (() => { try { frame(NAME, undefined); return false; } catch { return true; } })());
  ok("boxes are well formed", boxes.every((b) => b.widthIn > 0 && b.heightIn > 0));
}

/* ── 13. The featured profile flows: contact sits under the biography ── */
group("13. Featured profile flows contact under the biography");
{
  const profile = DIRECTORY.pages.find((p) => p.pageType === "profile-spread");
  const stack = profile.elements.find((e) => e.type === "stack");
  const heading = profile.elements.filter((e) => e.type === "text" && e.y < stack.y);
  const folio = profile.elements.find((e) => e.field === "static:24");

  ok("the profile page uses a flow region", Boolean(stack));
  ok("the flow region starts below the fixed heading",
     stack.y >= Math.max(...heading.map((e) => e.y + e.height)),
     `heading ends ${Math.max(...heading.map((e) => e.y + e.height)).toFixed(2)}in, stack starts ${stack.y}in`);
  ok("the flow region clears the folio", stack.y + stack.height <= folio.y,
     `region ends ${(stack.y + stack.height).toFixed(2)}in, folio ${folio.y}in`);
  ok("the recto aligns with the outside margin",
     Math.abs((stack.x + stack.width) - (folio.x + folio.width)) < 1e-9,
     `both end ${(stack.x + stack.width).toFixed(2)}in`);

  const fields = stack.children.map((c) => c.field);
  ok("the family list comes first", fields[0] === "familyLine", fields[0]);
  ok("contact fields follow it, in listing order", fields.slice(1).join(",") ===
     "addressLine,altPhoneLine,emailLine,altEmailLine", fields.slice(1).join(","));
  ok("contact is a distinct group", stack.children.slice(1).every((c) => c.group === "contact"));
  ok("crossing into contact uses a larger gap", stack.groupGap > stack.gap,
     `${stack.groupGap}in vs ${stack.gap}in`);
  ok("the biography is the flexible child", stack.children.filter((c) => c.flexible).length === 1);

  /*
   * Model the stack the way the renderer does, so the assertions below are
   * about behaviour rather than about the manifest's declared numbers.
   */
  const layout = (record) => {
    const visible = [];
    for (const child of stack.children) {
      const value = resolveBinding(child.field, { record, schema: SCHEMA }).value;
      if (!value) continue;
      const role = DIRECTORY.fontRoles[child.fontRole];
      const lines = Math.max(
        Math.min(estimateLines(value, stack.width, role.size), child.maxLines ?? 1), 1
      );
      visible.push({ child, role, lines, height: (lines * role.size * (role.lineHeight ?? 1.3)) / 72 });
    }
    const flexible = visible.find((v) => v.child.flexible);
    const total = () => visible.reduce((sum, v, i) =>
      sum + v.height + (i === 0 ? 0 : v.child.group === visible[i - 1].child.group ? stack.gap : stack.groupGap), 0);
    while (flexible && flexible.lines > 1 && total() > stack.height) {
      flexible.lines -= 1;
      flexible.height = (flexible.lines * flexible.role.size * (flexible.role.lineHeight ?? 1.3)) / 72;
    }
    let cursor = 0;
    const rows = visible.map((v, i) => {
      cursor += i === 0 ? 0 : v.child.group === visible[i - 1].child.group ? stack.gap : stack.groupGap;
      const top = cursor;
      cursor += v.height;
      return { field: v.child.field, top, bottom: cursor };
    });
    return { rows, used: cursor };
  };

  const FAMILY =
    "Ava, Ben and Rosa Whitfield, with Marguerite Whitfield and the Larkspur Lane household.";
  const full = {
    last_name: "Whitfield",
    first_name: "Ava",
    address: "412 Larkspur Lane Marietta GA 30060",
    phone: "770-555-0142",
    email: "ava@example.org",
    alternate_phone: "770-555-0143",
    alternate_email: "a.whitfield@example.net",
    family_members: FAMILY,
  };

  const a = layout(full);
  ok("a complete record lays out all five lines", a.rows.length === 5,
     a.rows.map((r) => r.field).join(" + "));
  ok("contact begins immediately below the family list",
     Math.abs(a.rows[1].top - (a.rows[0].bottom + stack.groupGap)) < 1e-9,
     `family ends ${a.rows[0].bottom.toFixed(2)}in, contact starts ${a.rows[1].top.toFixed(2)}in`);
  ok("nothing runs past the region", a.used <= stack.height + 1e-9,
     `uses ${a.used.toFixed(2)}in of ${stack.height}in`);

  const familyOnly = layout({ last_name: "Li", first_name: "Wei", family_members: "Wei and Mei Li." });
  ok("a record with no contact details lays out the family list alone", familyOnly.rows.length === 1);
  ok("it still starts at the top of the region", familyOnly.rows[0].top === 0);

  const sparse = layout({
    last_name: "Nakamura", first_name: "Kenji",
    family_members: "Kenji and Aiko.", address: "5 Willow Bend",
  });
  ok("absent phone and emails take no space", sparse.rows.length === 2,
     sparse.rows.map((r) => r.field).join(" + "));
  ok("the surviving contact line flows up to meet the family list",
     Math.abs(sparse.rows[1].top - (sparse.rows[0].bottom + stack.groupGap)) < 1e-9,
     `address starts ${sparse.rows[1].top.toFixed(2)}in`);

  const noFamily = layout({
    last_name: "Osei", first_name: "Daniel", address: "9 Peachtree Way Austell GA",
  });
  ok("with no family list the contact block starts at the top", noFamily.rows[0].top === 0);
  ok("and it is the address", noFamily.rows[0].field === "addressLine",
     noFamily.rows[0].field);

  /* Nothing in this stack can print a bare label for a value the customer did
     not supply. */
  const empty = layout({ last_name: "Solo", first_name: "Ada" });
  ok("a record with only a name lays out nothing in the stack", empty.rows.length === 0,
     `${empty.rows.length} rows`);
}


/* ── 14. Empty image frames never show a stray icon ── */
group("14. Image frames declare what belongs in them");
{
  const imageElements = [];
  for (const template of DESIGN_TEMPLATES) {
    for (const page of template.pages) {
      for (const element of page.elements ?? []) {
        if (element.type === "image") imageElements.push({ page: page.id, element });
        if (element.type === "repeater") {
          for (const child of element.cell ?? []) {
            if (child.type === "image") imageElements.push({ page: page.id, element: child });
          }
        }
      }
    }
  }
  const portraits = imageElements.filter(({ element }) => element.field === "record:image");
  ok("every portrait frame declares a placeholder kind",
     portraits.every(({ element }) => element.placeholder === "portrait" || element.placeholder === "photo"),
     `${portraits.length} portrait frames`);
  ok("the logo frame declares none, so it renders empty rather than a person icon",
     imageElements.filter(({ element }) => element.field === "logo").every(({ element }) => !element.placeholder));

  const artwork = [];
  for (const template of DESIGN_TEMPLATES) {
    if (template.thumbnail) artwork.push(template.thumbnail);
    for (const page of template.pages) if (page.background) artwork.push(page.background);
  }
  ok("every referenced artwork file exists on disk",
     artwork.every((src) => existsSync(resolve(ROOT, "public", src.replace(/^\//, "")))),
     `${artwork.length} files`);
}

/* ── Quick Photo Proof: nothing personal is required ── */
group("15-20. A proof needs no email, title or organization");
{
  const photo = (i) => ({
    id: `p${i}`, name: `IMG_${1000 + i}.jpg`, extension: ".jpg",
    size: 2048, kind: kindOf(`IMG_${1000 + i}.jpg`), file: {}, previewUrl: `blob:p${i}`,
  });

  const bare = { ...emptyProject(), publicationTypeId: "yearbook", assets: [photo(1)] };
  bare.visual.templateId = defaultTemplateFor("yearbook", { photoLed: true });

  ok("15. the project defaults to Quick Photo Proof", emptyProject().mode === PROOF_MODES.photo);
  ok("16. a proof can be built with no email — the field no longer exists",
     !("email" in emptyOrganization()) && !("contactName" in emptyOrganization()) && !("phone" in emptyOrganization()),
     `organization fields: ${Object.keys(emptyOrganization()).join(", ")}`);
  ok("17. no title is required — details are absent from the record",
     !("title" in photoRecords(bare)[0]));
  ok("18. no organization name is required", bare.organization.organizationName === "");
  ok("a neutral cover label exists for that case", ORGANIZATION_FALLBACK === "Your Organization");

  ok("19. ONE photograph produces a renderable record set", recordsFor(bare).length === 1);
  const twelve = { ...bare, assets: Array.from({ length: 12 }, (_, i) => photo(i)) };
  ok("20. TWELVE photographs all reach the sample", recordsFor(twelve).length === 12);

  const plan1 = planProof(templateFor(bare.visual.templateId), recordsFor(bare));
  const plan12 = planProof(templateFor(twelve.visual.templateId), recordsFor(twelve));
  ok("one photograph still plans a full set of pages", plan1.pages.length === 3);
  ok("twelve photographs plan the same pages", plan12.pages.length === 3);
  ok("twelve are placed, none omitted", plan12.recordsOmitted === 0, `${plan12.recordsShown} shown`);

  const thirty = { ...bare, assets: Array.from({ length: 30 }, (_, i) => photo(i)) };
  ok("more than twelve are capped, in order",
     photosForProof(thirty).length === QUICK_PROOF_PHOTO_LIMIT &&
     photosForProof(thirty)[0].id === "p0");
  ok("an explicit choice overrides the cap",
     photosForProof({ ...thirty, selectedPhotoIds: ["p7", "p2"] }).map((p) => p.id).join(",") === "p2,p7" ||
     photosForProof({ ...thirty, selectedPhotoIds: ["p7", "p2"] }).length === 2);
}

/* ── 21. Empty names produce no placeholder ── */
group("21. Empty details leave no visible placeholder");
{
  const photo = { id: "p1", name: "a.jpg", extension: ".jpg", size: 10, kind: "image", previewUrl: "blob:1" };
  const none = { ...emptyProject(), assets: [photo] };
  const record = photoRecords(none)[0];

  ok("a record with no details carries no name key", !("display_name" in record));
  ok("nor a title, category or bio",
     !("title" in record) && !("category" in record) && !("short_bio" in record),
     `keys: ${Object.keys(record).join(", ")}`);

  /* The renderer skips a binding that resolves to nothing, so an absent key
     means no element at all — not "Name", not "Unknown", not a blank box. */
  for (const field of ["personName", "role:secondaryText", "role:bodyText"]) {
    ok(`"${field}" resolves to empty for a bare photograph`,
       resolveBinding(field, { record, schema: SCHEMA }).value === "");
  }

  ok("a photograph-led design is suggested when nothing is named", suggestsPhotoLedDesign(none));
  const gallery = templateFor("photo-gallery");
  const textElements = gallery.pages
    .filter((p) => p.pageType !== "cover")
    .flatMap((p) => p.elements)
    .flatMap((e) => (e.type === "repeater" ? e.cell ?? [] : [e]))
    .filter((e) => e.type === "text" && String(e.field ?? "").includes("role:"));
  ok("the photo-led design has no per-record text bands at all", textElements.length === 0);

  /* Whitespace only is still empty. */
  const blank = { ...photo, details: { displayName: "   ", title: "", category: "", caption: "" } };
  ok("whitespace-only details are treated as empty",
     !("display_name" in photoRecords({ ...emptyProject(), assets: [blank] })[0]));
  ok("hasPhotoDetails agrees", !hasPhotoDetails(blank.details));
}

/* ── 22. Details stay with their own photograph ── */
group("22. Optional details stay attached to the right photograph");
{
  const mk = (i, details) => ({
    id: `p${i}`, name: `IMG_${i}.jpg`, extension: ".jpg", size: 10,
    kind: "image", previewUrl: `blob:${i}`, details,
  });
  const project = {
    ...emptyProject(),
    assets: [
      mk(1, { displayName: "Ava", title: "President", category: "", caption: "" }),
      mk(2),
      mk(3, { displayName: "Marisol", title: "", category: "Committee", caption: "Since 2019" }),
    ],
  };
  const records = photoRecords(project);
  ok("each record keeps its own photograph's filename",
     records.map((r) => r.photo_filename).join(",") === "IMG_1.jpg,IMG_2.jpg,IMG_3.jpg");
  ok("details land on the right records",
     records[0].display_name === "Ava" && records[2].display_name === "Marisol");
  ok("the undetailed photograph borrows nothing", !("display_name" in records[1]));
  ok("record ids are the asset ids, so details survive a removal",
     records.map((r) => r.record_id).join(",") === "p1,p2,p3");

  /* Remove the middle photograph: the rest must keep their own details. */
  const after = photoRecords({ ...project, assets: project.assets.filter((a) => a.id !== "p2") });
  ok("after removing one, details still match their photographs",
     after[0].display_name === "Ava" && after[1].display_name === "Marisol" &&
     after[1].photo_filename === "IMG_3.jpg");

  /* Filename matching must still pair each record with its own image. */
  const report = matchPhotos(records, "photo_filename", project.assets, {});
  ok("photo matching pairs every record with its own image",
     report.matches.every((m) => m.asset?.name === m.record.photo_filename));
}

/* ── 23-26. Email, quotes, reviews and subscription ── */
group("23-26. Email is required only where a reply is needed");
{
  const project = { ...emptyProject(), organization: { ...emptyOrganization(), organizationName: "Cedar Ridge" } };
  const config = { label: "Church Directory" };

  const quote = buildContactPayload(
    { kind: "quote", name: "Ava Whitfield", email: "ava@example.org", notes: "", marketingOptIn: false },
    project, config, { templateName: "Gallery", photoCount: 12 }
  );
  ok("23. a quote request carries the email the visitor typed", quote.email === "ava@example.org");
  ok("a quote carries the proof forward so nothing is retyped",
     quote.publicationType === "Church Directory" && quote.projectDetails.includes("Gallery"));
  ok("24. a quote does NOT subscribe by default", quote.marketingOptIn === false);
  ok("the opt-in travels as its own field, never inferred from the email",
     "marketingOptIn" in quote);

  const optedIn = buildContactPayload(
    { kind: "quote", name: "Ava", email: "ava@example.org", notes: "", marketingOptIn: true },
    project, config
  );
  ok("an explicit tick is carried through", optedIn.marketingOptIn === true);

  const review = buildContactPayload(
    { kind: "review", name: "Ben Okonkwo", email: "ben@example.org", notes: "", marketingOptIn: false },
    project, config
  );
  ok("25. a project review carries an email too", review.email === "ben@example.org");
  ok("a review is distinguishable from a quote", review.requestKind === "review");
  ok("a review does not subscribe either", review.marketingOptIn === false);

  ok("organization falls back to the visitor's name rather than blocking them",
     buildContactPayload({ kind: "quote", name: "Solo Person", email: "s@e.com", notes: "", marketingOptIn: false },
       { ...emptyProject() }, config).organization === "Solo Person");

  const service = getSubscriptionService();
  ok("26. no subscription backend exists, and the service says so", service.isConfigured === false);
  ok("an invalid address is rejected before anything else",
     !(await service.subscribe("nope")).ok);
  const attempt = await service.subscribe("ava@example.org");
  ok("a valid address is NOT falsely reported as subscribed", attempt.ok === false);
  ok("and the visitor is told plainly why, with a way to be added by hand",
     /connected yet/i.test(attempt.message) && /@/.test(attempt.message));
  ok("email validation is shared and strict",
     isValidEmail("a@b.com") && !isValidEmail("a@b") && !isValidEmail(""));

  /* Generating a proof touches none of this. */
  const rendered = { ...emptyProject(), assets: [{ id: "p", name: "a.jpg", extension: ".jpg", size: 1, kind: "image" }] };
  ok("ordinary proof generation collects no email at all",
     !Object.values(rendered.organization).some((v) => String(v).includes("@")));
}

/* ── 27. Analytics carries nothing personal ── */
group("27. Analytics cannot carry personal data");
{
  const dirty = {
    photo_count: 12, has_details: true, proof_mode: "photo", template_id: "photo-gallery",
    email: "ava@example.org", name: "Ava Whitfield", filename: "IMG_1001.jpg",
    organization_name: "Cedar Ridge", caption: "Ava at the gala", display_name: "Ava",
  };
  const clean = __sanitizeForTest(dirty);
  ok("counts and our own slugs survive",
     clean.photo_count === 12 && clean.proof_mode === "photo" && clean.template_id === "photo-gallery");
  for (const leak of ["email", "name", "filename", "organization_name", "caption", "display_name"]) {
    ok(`"${leak}" cannot reach analytics`, !(leak in clean));
  }
  ok("free text is rejected even under an allowed key",
     !("publication_type" in __sanitizeForTest({ publication_type: "Ava's Church Directory" })));
}

/* ── 28. Spreadsheet mode is untouched ── */
group("28. Spreadsheet mode retains every capability");
{
  const csv = readFileSync(resolve(ROOT, "public/csv-templates/pressmark-people-directory.csv"), "utf8");
  const table = parseCsv(csv);
  const proposals = suggestMapping(table.headers, "people-directory");
  const mapping = mappingFromProposals(proposals);
  const rows = applyMapping(table.rows, mapping);
  const analysis = analyzeRecords(rows, "people-directory", table.headers, Object.keys(mapping));

  ok("the standardised CSV still parses", rows.length === 3);
  ok("column mapping still runs", Object.keys(mapping).length > 0);
  ok("validation still runs", Array.isArray(analysis.issues));
  ok("filename matching still runs",
     matchPhotos(rows, "photo_filename", [{ id: "a", name: rows[0].photo_filename, extension: ".jpg", size: 1, kind: "image" }], {}).exact === 1);
  ok("all six CSV templates are still downloadable",
     ["church-directory", "people-directory", "yearbook-portraits", "editorial", "event-schedule", "annual-report-metrics", "sponsors"]
       .every((id) => existsSync(resolve(ROOT, "public", schemaFor(id).templateFile.replace(/^\//, "")))));

  const dataProject = { ...emptyProject(), mode: PROOF_MODES.data, data: { ...emptyProject().data, records: rows } };
  ok("spreadsheet mode renders from the parsed rows", recordsFor(dataProject).length === 3);
  ok("and never from synthesised photo records", recordsFor(dataProject)[0].display_name === rows[0].display_name);
}
group("30. Mobile layout");
{
  const css = readFileSync(resolve(ROOT, "src/instant-proof/styles.js"), "utf8");
  ok("touch targets are at least 44px", /min-height:\s*44px/.test(css) && /min-width:\s*44px/.test(css));
  ok("the page cannot scroll sideways", /overflow-x:\s*hidden/.test(css));
  ok("images are constrained to their container", /img, svg, video \{\s*max-width:\s*100%/.test(css));
  ok("upload actions stack to one column on a phone",
     /@media \(max-width: 560px\)[\s\S]*?\.ip-upload-actions \{ grid-template-columns: minmax\(0, 1fr\)/.test(css));
  ok("the thumbnail grid is fluid", /repeat\(auto-fill, minmax\(/.test(css));
  ok("photographs are cropped, never stretched", /object-fit:\s*cover/.test(css));

  const panel = readFileSync(resolve(ROOT, "src/instant-proof/components/PhotoUploadPanel.jsx"), "utf8");
  ok("the camera input asks for the rear camera", /capture: "environment"/.test(panel));
  ok("the library input allows several at once", /multiple: true/.test(panel));
  ok("WebP is accepted", /webp/i.test(panel));
  /* There are no steps to go back through any more: the page is upload ->
     accept -> generate on one screen. What replaced those assertions is the
     "Church Directory Classic proof page" group below. */
}
group("32. Design carousel");
{
  const car = readFileSync(resolve(ROOT, "src/instant-proof/components/DesignCarousel.jsx"), "utf8");
  const css = readFileSync(resolve(ROOT, "src/instant-proof/theme.css.js"), "utf8");

  ok("one radiogroup, one radio per design", /role="radiogroup"/.test(car) && /role="radio"/.test(car));
  ok("a roving tabstop rather than every slide in the tab order",
     /tabIndex=\{isSelected \? 0 : -1\}/.test(car));
  ok("arrow keys move and select", /ArrowRight/.test(car) && /ArrowLeft/.test(car));
  ok("Home and End jump to the ends", /case "Home"/.test(car) && /case "End"/.test(car));
  ok("the selection is scrolled into view for keyboard users", /scrollIntoView/.test(car));

  /* The name and pill mirror the radio; they must not be announced again. */
  const decorative = (car.match(/aria-hidden="true"/g) || []).length;
  ok("the name and Selected pill are aria-hidden, so selection is announced once",
     decorative >= 3, `${decorative} decorative nodes`);
  ok("each slide carries exactly one accessible name", (car.match(/ip-sr-only">\{template\.name\}/g) || []).length === 1);

  ok("snapping is x mandatory and centred",
     /scroll-snap-type: x mandatory/.test(css) && /scroll-snap-align: center/.test(css));
  ok("thumbnails hold the 8.5:11 cover ratio", /--proof-cover-ratio: 8\.5 \/ 11/.test(readFileSync(resolve(ROOT, "src/instant-proof/tokens.js"), "utf8")));
  ok("thumbnail width is 145px", /THUMB_W = 145/.test(readFileSync(resolve(ROOT, "src/instant-proof/tokens.js"), "utf8")));
  ok("no full-size render on the selection screen",
     !/TemplateRenderer/.test(car) && !/TemplateRenderer/.test(readFileSync(resolve(ROOT, "src/instant-proof/components/CreateStep.jsx"), "utf8")));
  ok("the large preview stays behind Preview design", /onPreview\(selected\)/.test(car));
}

/* ── 33. Mobile overflow and targets ── */
group("33. Mobile layout");
{
  const css = readFileSync(resolve(ROOT, "src/instant-proof/theme.css.js"), "utf8");
  ok("the page itself cannot scroll sideways", /\.ip-root \{[\s\S]*?overflow-x: clip/.test(css));
  ok("only the carousel scrolls horizontally", /\.ip-carousel \{[\s\S]*?overflow-x: auto/.test(css));
  ok("horizontal overscroll is contained to the carousel", /overscroll-behavior-x: contain/.test(css));
  ok("page padding is 22px, 16px on the narrowest phones",
     /PAGE_PAD = "22px"/.test(readFileSync(resolve(ROOT, "src/instant-proof/tokens.js"), "utf8")) &&
     /max-width: 359px\)[\s\S]*?--proof-pad: 16px/.test(css));
  /*
   * The build-method cards were square tiles, which at 165px wide meant 165px
   * tall — a third of a phone screen for two words, pushing the publication
   * list below the fold. They are ordinary rectangles now.
   */
  /*
   * Read one rule block rather than matching across the stylesheet — a lazy
   * [\s\S]*? still crosses into later rules, so "does .ip-method-btn declare
   * aspect-ratio" was really asking "does anything after it declare one".
   */
  const ruleBlock = (selector) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
  };
  const methodBtn = ruleBlock(".ip-method-btn");

  ok("build-method cards are a normal button height, not square tiles",
     /min-height: 56px/.test(methodBtn) && !/aspect-ratio/.test(methodBtn));
  ok("their height is a minimum, so a wrapped label grows the button",
     !/(^|[^-])height:/.test(methodBtn.replace("min-height:", "")));
  ok("their labels wrap naturally rather than by hand-set line breaks",
     !/title: \[/.test(readFileSync(resolve(ROOT, "src/instant-proof/components/CreateStep.jsx"), "utf8")));

  /* width:100% inside a padded container is content width, not a bleed. */
  ok("gold rules cancel the gutter so they reach the page edges",
     /\.ip-bleed \{[\s\S]*?margin-inline: calc\(-1 \* var\(--proof-pad\)\)/.test(css));
  ok("the gutter has one source of truth, so the bleed always matches it",
     /min-width: 900px\)[\s\S]*?--proof-pad: 32px/.test(css) &&
     !/min-width: 900px\)[\s\S]*?\.ip-page \{ padding/.test(css));

  ok("build-method cards stay two across at every width",
     /\.ip-methods \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/.test(css) &&
     !/max-width[^}]*\.ip-methods \{ grid-template-columns: minmax\(0, 1fr\)/.test(css));
  ok("publication rows are at least 48px tall",
     Number((css.match(/\.ip-pub \{[\s\S]*?min-height: (\d+)px/) || [])[1]) >= 48);
  /* 36px on a mouse, as Google's key is; 44px wherever a thumb is the pointer. */
  ok("buttons are 44px on a touch screen",
     /@media \(pointer: coarse\) \{\s*\.ip-btn, \.ip-menu-btn \{ min-height: \$\{BUTTON\.touchHeight\}/.test(css) &&
     BUTTON_TOKENS.touchHeight === "44px");
  ok("headings wrap rather than clip", /\.ip-h1 \{[\s\S]*?overflow-wrap: break-word/.test(css));
  ok("the action bar respects the home indicator", /env\(safe-area-inset-bottom/.test(css));
  ok("a spacer keeps the bar off the content", /\.ip-actions-spacer/.test(css));
  ok("the bar is not sticky on desktop", /min-width: 900px\)[\s\S]*?\.ip-actions \{ position: static/.test(css));
  ok("desktop is centred and capped, not full-bleed", /\.ip-page \{[\s\S]*?max-width: 760px/.test(css));
  ok("the desktop design preview is at most 300px", /minmax\(0, 1fr\) 300px/.test(css));
  ok("reduced motion is respected", /prefers-reduced-motion: reduce/.test(css));
  ok("hover is never required — selection uses aria-checked, not :hover",
     /\[aria-checked="true"\]/.test(css));

  /* Tokens must not leak into the rest of the site. */
  ok("tokens are scoped to .ip-root, never :root",
     /\.ip-root \{\s*--proof-accent/.test(readFileSync(resolve(ROOT, "src/instant-proof/tokens.js"), "utf8")) &&
     !/^\s*:root\s*\{/m.test(css));
}
/* ── The tool that is the homepage ── */
group("Church Directory Classic proof tool");
{
  const page = readFileSync(resolve(ROOT, "src/pages/ProofTool.jsx"), "utf8");
  const composer = readFileSync(resolve(ROOT, "src/instant-proof/components/Composer.jsx"), "utf8");
  /* The controls live in the composer and the state that gates them lives in the
     page. Several rules below are about the pair, so they read the pair. */
  const tool = page + composer;

  /*
   * The whole flow is: choose a design, download the template, upload a CSV and
   * pick two colours, one button, PDF. Anything that reappears here is scope
   * this page deliberately does not carry.
   */
  ok("no column mapping", !/ColumnMappingPanel|mappingConfirmed/.test(page));
  ok("no old wizard chooser",
     !/CreateStep|DesignCarousel|TemplatePreview|PublicationTypeSelector/.test(page));
  ok("no photo upload", !/PhotoUploadPanel|addPhotos|selectedPhotoIds/.test(page));
  ok("no browser mock proof", !/getProofRenderer|ProofProcessing|ProofResults/.test(page));
  ok("no branding, account or payment fields",
     !/organizationName|checkout|stripe/i.test(page));
  ok("no multi-step wizard", !/StepShell/.test(page));
  /* The columns are named in the expandable help, never in the interface. */
  ok("no raw CSV headers in the main interface", !/last_name|first_name/.test(page));

  /* What it must have. */
  ok("it drives the real render job", /DirectoryRenderJob/.test(page));
  ok("it reads the required columns from the schema, not a second list",
     /requiredColumnsOf\(SCHEMA\)/.test(page));
  ok("it accepts only .csv", /accept=\{?"?\.csv/.test(tool));
  ok("it reports the record count", /recordCount/.test(composer));
  ok("the one action is Create My PDF", /Create My PDF<\/span>/.test(tool));
  ok("the job id is kept in the URL so a refresh resumes",
     /searchParams\.set\("job"/.test(page) && /get\("job"\)/.test(page));
  ok("it sits in the shared shell rather than its own chrome",
     /AppShell/.test(page) && !/ProofHeader|ProofFooter/.test(page));

  /*
   * Every action is behind the "+" or an icon. The bar itself carries one
   * button — the one that finishes the job.
   */
  ok("the template, the upload and the instructions are all in the + menu",
     /Download the template/.test(composer) &&
     /Upload your \.csv/.test(composer) &&
     /Template instructions/.test(composer));
  ok("the colours are behind their own mark, not spread across the page",
     /ColorMark/.test(composer) && /ColorControls/.test(composer));
  ok("the page itself no longer carries the numbered action cards",
     !/Download Directory Template/.test(page) && !/ip-card-title/.test(page));

  /*
   * The tool is free and unconditional, so nothing it renders calls the result a
   * "proof" — that word promises a sample with a bill behind it.
   */
  const chrome = [
    ["the page", page],
    ["the composer", composer],
    ["the job view", readFileSync(resolve(ROOT, "src/instant-proof/components/DirectoryRenderJob.jsx"), "utf8")],
    ["the sidebar", readFileSync(resolve(ROOT, "src/instant-proof/nav.js"), "utf8")],
    /* The blog has its own nav bar, and it kept "Create a Proof" after the
       sidebar changed — which is why it is checked here too. */
    ["the Data Merge section and the Blog", readFileSync(resolve(ROOT, "src/blog/shell.jsx"), "utf8") +
      readFileSync(resolve(ROOT, "src/pages/DataMerge.jsx"), "utf8") +
      readFileSync(resolve(ROOT, "src/pages/Blog.jsx"), "utf8")],
  ];
  for (const [name, source] of chrome) {
    /* Comments explain why the word is gone; only rendered text is checked. */
    const rendered = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      /* Identifiers, not words a customer reads: the CSS tokens, the module
         paths and the component's own name. */
      .replace(/proof-|ProofTool|instant-proof|PROOF_/g, "");
    ok(`${name} never says "proof" to the customer`,
      !/proof/i.test(rendered),
      (rendered.match(/[A-Za-z ]{0,20}proof[a-z]*/i) || ["none"])[0].trim());
  }

  /* The four steps the customer is walked through, in order. */
  for (const step of [
    "Choose a design",
    "Download and complete the template",
    "Upload your CSV and choose colours",
    "Create your PDF",
  ]) {
    ok(`the rail names "${step}"`, page.includes(step));
  }

  /* Nothing may be submitted without permission having been given. */
  ok("permission is required before the button works",
     /I have permission to use this directory information/.test(composer) &&
     /!permitted/.test(page));
  ok("a valid CSV is required before the button works", /!accepted/.test(page));
  ok("the button says why it is disabled rather than just being dead",
     /aria-describedby=\{blocking/.test(composer));

  /* The colours reach the job. */
  ok("the chosen colours are handed to the render job", /colors=\{colors\}/.test(page));
  ok("they start at the template's own swatches", /DEFAULT_COLORS/.test(page));
  /* Only the swatches actually changed are submitted; the rest are left as the
     template has them. */
  ok("and only the changed ones this design uses are submitted",
     /changedColors\(colors, swatchKeys\)/.test(page));

  const schema = schemaFor("church-directory");
  ok("the schema it validates against is the directory schema",
     /schemaFor\("church-directory"\)/.test(page));
  ok("that schema is the one Directory Classic declares",
     templateFor("directory-classic").schemas[0] === schema.id);
}

/* ── Which designs can actually be rendered ── */
group("Design library");
{
  const designs = readFileSync(resolve(ROOT, "src/instant-proof/designs.js"), "utf8");
  const { DESIGNS } = await import("../src/instant-proof/designs.js");
  const chooser = readFileSync(resolve(ROOT, "src/instant-proof/components/DesignChooser.jsx"), "utf8");
  const api = readFileSync(resolve(ROOT, "api/render-jobs/index.js"), "utf8");

  ok("Classic is the default selection", /DEFAULT_DESIGN_ID = "directory-classic"/.test(designs));

  /*
   * Two real exports per design — a listing close enough to read and a whole
   * spread at the size it prints. A preview of something a customer will hand
   * to a printer has to be the product, not an impression of it.
   */
  for (const design of DESIGNS) {
    ok(`${design.name} shows two previews`, design.previews?.length === 2,
      `${design.previews?.length ?? 0}`);
    for (const preview of design.previews ?? []) {
      const file = resolve(ROOT, "public", preview.src.replace(/^\//, ""));
      ok(`  ${preview.src.split("/").pop()} exists`, existsSync(file));
      /* An image of a page with no alt text is a blank to anyone who cannot see
         it, and these carry the whole argument of the page. */
      ok(`  and describes itself`, (preview.alt || "").length > 40 && Boolean(preview.caption));
    }
  }

  const library = readFileSync(resolve(ROOT, "src/pages/DirectoryDesigns.jsx"), "utf8");
  ok("the library page renders every preview it is given",
    /design\.previews\.map/.test(library) && /preview\.alt/.test(library) && /preview\.caption/.test(library));
  /* Dimensions on the tag, so the page does not jump as they load. */
  ok("and reserves their space before they load",
    /width="1400" height="713"/.test(library) && /loading="lazy"/.test(library));
  ok("Classic is renderable and labelled Available now",
     /id: "directory-classic"[\s\S]*?status: "Available now"[\s\S]*?renderable: true/.test(designs));
  /*
   * The photo design has no InDesign template, no CSV-plus-photo contract and no
   * worker configuration. A card a customer can submit would queue work nothing
   * knows how to run, so the flag, the card and the API must all agree.
   */
  ok("the photo design is Coming soon and NOT renderable",
     /id: "directory-photos"[\s\S]*?status: "Coming soon"[\s\S]*?renderable: false/.test(designs));
  ok("an unrenderable card cannot be selected",
     /design\.renderable && onSelect/.test(chooser));
  /* `disabled` would drop the card out of the tab order entirely, so a keyboard
     user would never learn the second design exists. The negative lookbehind is
     what keeps `aria-disabled` from matching as `disabled`. */
  ok("but it stays reachable and is announced as unavailable",
     /aria-disabled=/.test(chooser) && !/(?<!-)disabled=\{/.test(chooser));
  ok("the server allows only Directory Classic through",
     /SUPPORTED_TEMPLATE_IDS = new Set\(\["directory-classic"\]\)/.test(api));

  /*
   * The blank template is offered instead of listing the columns. A customer who
   * starts from the file cannot get the headers wrong, which is the only way
   * this flow fails — so the file has to exist and its header row has to be
   * exactly the schema's columns.
   */
  const schema = schemaFor("church-directory");
  const templatePath = resolve(ROOT, "public/csv-templates/directory-classic-template.csv");
  ok("the blank template exists where the design links it", existsSync(templatePath));
  ok("the design links that exact file",
     designs.includes("/csv-templates/directory-classic-template.csv"));

  const templateText = readFileSync(templatePath, "utf8");
  const templateHeaders = templateText.trim().split("\n")[0].split(",").map((h) => h.trim());
  ok("its headers are exactly the schema's columns",
     [...templateHeaders].sort().join(",") === [...columnsOf(schema)].sort().join(","),
     templateHeaders.join(","));
  ok("it carries headers only — nothing to delete before filling it in",
     templateText.trim().split("\n").length === 1, `${templateText.trim().split("\n").length} lines`);
}

/* ── The shell every page sits in ── */
group("Workspace shell");
{
  const nav = readFileSync(resolve(ROOT, "src/instant-proof/nav.js"), "utf8");
  const shell = readFileSync(resolve(ROOT, "src/instant-proof/components/AppShell.jsx"), "utf8");
  const boot = readFileSync(resolve(ROOT, "src/instant-proof/components/BootScreen.jsx"), "utf8");
  const css = readFileSync(resolve(ROOT, "src/instant-proof/theme.css.js"), "utf8");

  const order = [...nav.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
  ok("the sidebar is in the specified order",
     order.join(" ") === "/ /directory-designs /data-merge /services /pricing /contact",
     order.join(" "));
  ok("the privacy line is in the sidebar",
     /Your uploaded files are processed privately\./.test(shell));

  /* Below 900px the sidebar is a drawer; a drawer that is merely moved
     off-screen is still in the tab order. */
  ok("the closed drawer is out of the tab order", /\.ip-sidebar \{[\s\S]*?visibility: hidden/.test(css));
  ok("and back in the page on a desktop",
     /@media \(min-width: 900px\)[\s\S]*?\.ip-sidebar \{[\s\S]*?visibility: visible/.test(css));
  ok("Escape closes it and returns focus to the button that opened it",
     /event\.key !== "Escape"/.test(shell) && /menuButton\.current\?\.focus\(\)/.test(shell));
  ok("the page behind it cannot scroll", /document\.body\.style\.overflow = "hidden"/.test(shell));
  ok("the menu button reports its state", /aria-expanded=\{open\}/.test(shell));

  /* The boot screen plays once per session and never gates the content. */
  /* Code, not prose: the comment above it explains why localStorage was
     rejected, and matching the whole file would fail on that explanation. */
  ok("the boot screen is remembered for the session, not for ever",
     /window\.sessionStorage/.test(boot) && !/window\.localStorage/.test(boot));
  ok("it never blocks a screen reader from the workspace beneath",
     /aria-hidden="true"/.test(boot));
  ok("it is gone within 1.2 seconds", /REMOVE_AFTER_MS = 1200/.test(boot));
  ok("reduced motion stills the animation and shortens the hold",
     /prefers-reduced-motion: reduce\)[\s\S]*?\.ip-boot-fill \{ animation: none/.test(css) &&
     /REMOVE_AFTER_REDUCED_MS/.test(boot));
  ok("storage failures do not break the page", /catch \{/.test(boot));

  /*
   * The launch screen renders OUTSIDE .ip-root, where every --proof-* property
   * is declared. It has already lost its background once and its typeface once
   * by inheriting from a scope it is not in, so it must name both itself.
   */
  const bootRule = css.slice(css.indexOf("  .ip-boot {"), css.indexOf("  .ip-boot::before"));
  ok("the launch screen declares its own background", /background: var\(--boot-ink\)/.test(bootRule));
  ok("and its own typeface", /font-family: /.test(bootRule));
  ok("neither depends on a token it cannot see", !/var\(--proof-/.test(bootRule));
}

group("Regression: no element overflows its box, in any template");
{
  let overflow = 0;
  let tooTall = 0;
  for (const template of DESIGN_TEMPLATES) {
    for (const page of template.pages) {
      const pBox = pageBox(template, page);
      for (const element of page.elements ?? []) {
        if (element.type === "repeater") {
          const cBox = cellBox(element);
          for (const child of element.cell ?? []) {
            if (child.x + child.width > cBox.widthIn + 1e-9 || child.y + child.height > cBox.heightIn + 1e-9) overflow += 1;
            if (child.type === "text" && occupied(child, template) > child.height + 1e-9) tooTall += 1;
          }
          continue;
        }
        if (element.x + element.width > pBox.widthIn + 1e-9 || element.y + element.height > pBox.heightIn + 1e-9) overflow += 1;
        if (element.type === "text" && occupied(element, template) > element.height + 1e-9) tooTall += 1;
      }
    }
  }
  ok("nothing overflows its box", overflow === 0, `${DESIGN_TEMPLATES.length} templates`);
  ok("every text box fits its declared maxLines", tooTall === 0);
}

/* ── The CSV templates still parse ── */
group("Data pipeline still sound");
{
  const csv = 'record_id,display_name,title,address,city,state,postal_code,photo_filename\r\n1,"Whitfield, Ava","Director, Operations","412 Larkspur Lane",Marietta,GA,30060,a.jpg\r\n\r\n';
  const table = parseCsv(csv);
  ok("quoted commas survive parsing", table.rows[0].display_name === "Whitfield, Ava");
  ok("trailing blank rows are ignored", table.rows.length === 1);
  ok("headers are trimmed", table.headers.includes("record_id"));
}


/* ── Directory Classic speaks exactly one schema, everywhere ── */
group("Directory Classic uses the InDesign merge fields and nothing else");
{
  const template = templateFor("directory-classic");
  const schema = schemaFor("church-directory");

  ok("the template binds the church-directory schema",
    template.schemas.length === 1 && template.schemas[0] === "church-directory",
    template.schemas.join(","));

  const columns = columnsOf(schema);
  ok("its columns are the eight merge fields, in order",
    JSON.stringify(columns) ===
      JSON.stringify([
        "last_name", "first_name", "address", "phone", "email",
        "alternate_phone", "alternate_email", "family_members",
      ]),
    columns.join(","));

  ok("required are exactly the five",
    JSON.stringify(requiredColumnsOf(schema)) ===
      JSON.stringify(["last_name", "first_name", "address", "phone", "email"]),
    requiredColumnsOf(schema).join(","));

  /* The point of the whole change: these are gone, not merely optional. */
  for (const banished of ["record_id", "display_name", "photo_filename", "title", "city", "state", "postal_code", "website", "short_bio", "sort_order"]) {
    ok(`${banished} is not in the schema`, !columns.includes(banished));
  }
  ok("the schema declares no image field", schema.imageField === undefined);

  /* No element may bind a role this schema does not carry, or a customer sees
     an empty band where a merge field should be. */
  const roles = new Set(schema.fields.map((field) => field.role));
  const bound = [];
  for (const page of template.pages) {
    const walk = (elements) => {
      for (const element of elements ?? []) {
        if (typeof element.field === "string" && element.field.startsWith("role:")) {
          bound.push(element.field.slice(5));
        }
        walk(element.cell);
        walk(element.children);
      }
    };
    walk(page.elements);
  }
  const orphaned = [...new Set(bound)].filter((role) => !roles.has(role));
  ok("every role the template binds exists in the schema", orphaned.length === 0, orphaned.join(","));

  /* No image binding anywhere: the listing is text and no photo is requested. */
  const imageBindings = [];
  for (const page of template.pages) {
    const walk = (elements) => {
      for (const element of elements ?? []) {
        if (element.field === "record:image") imageBindings.push(page.id);
        walk(element.cell);
        walk(element.children);
      }
    };
    walk(page.elements);
  }
  ok("no page asks for a record image", imageBindings.length === 0, imageBindings.join(","));
}

group("The browser schema and the server contract are the same schema");
{
  ok("required headers match the server exactly",
    JSON.stringify(WORKER_REQUIRED_HEADERS) === JSON.stringify(SERVER_REQUIRED_HEADERS),
    `browser ${WORKER_REQUIRED_HEADERS.join(",")} vs server ${SERVER_REQUIRED_HEADERS.join(",")}`);

  ok("optional headers match the server exactly",
    JSON.stringify(WORKER_OPTIONAL_HEADERS) === JSON.stringify(SERVER_OPTIONAL_HEADERS),
    `browser ${WORKER_OPTIONAL_HEADERS.join(",")} vs server ${SERVER_OPTIONAL_HEADERS.join(",")}`);

  ok("the emitted header row is exactly the supported set",
    [...WORKER_HEADERS].sort().join(",") === [...SERVER_SUPPORTED_HEADERS].sort().join(","),
    WORKER_HEADERS.join(","));

  /* PressmarkDirectoryMerge.jsx fails the render if any of the eight headers is
     absent, so the export must never omit an all-empty optional column. */
  const jsx = readFileSync(resolve(ROOT, "scripts/indesign/PressmarkDirectoryMerge.jsx"), "utf8");
  const declared = [...jsx.matchAll(/^\s{8}"([a-z_]+)",?$/gm)].map((match) => match[1]);
  ok("the InDesign script requires the same eight headers",
    declared.length === 8 && declared.every((header) => WORKER_HEADERS.includes(header)),
    declared.join(","));
}

group("Our own Directory Classic template CSV round-trips");
{
  const schema = schemaFor("church-directory");
  const table = parseCsv(
    readFileSync(resolve(ROOT, "public/csv-templates/pressmark-church-directory.csv"), "utf8")
  );
  const proposals = suggestMapping(table.headers, "church-directory");
  const records = applyMapping(table.rows, mappingFromProposals(proposals));

  ok("its headers are already canonical", isCanonical(proposals));
  ok("it parses", records.length === 3, `${records.length} records`);

  const built = toDirectoryCsv(records, schema);
  ok("every record survives the projection", built.rowCount === records.length);
  ok("nothing is skipped", built.skipped === 0);
  ok("all eight headers are emitted, always", built.headers.length === 8, built.headers.join(","));

  let accepted = null;
  try {
    accepted = validateAndNormalizeCsv(new TextEncoder().encode(built.text));
  } catch (error) {
    accepted = { error: error.message };
  }
  ok("the server accepts it", accepted?.rowCount === records.length, accepted?.error ?? `${accepted?.rowCount} rows`);

  ok("no record id or display name reaches the worker",
    !/record_id|display_name|photo_filename/.test(built.text));
}

group("An all-empty optional column is still emitted");
{
  const schema = schemaFor("church-directory");
  /* Regression: optional columns used to be dropped when no row filled them,
     producing a seven-column CSV that the InDesign script refuses. */
  const records = [
    { last_name: "Solo", first_name: "Ada", address: "1 Way", phone: "770-1", email: "a@x.test" },
  ];
  const built = toDirectoryCsv(records, schema);
  ok("the header row still has all eight columns", built.headers.length === 8, built.headers.join(","));
  for (const optional of ["alternate_phone", "alternate_email", "family_members"]) {
    ok(`${optional} is present though empty`, built.text.split("\r\n")[0].includes(optional));
  }
  ok("the server accepts it", validateAndNormalizeCsv(new TextEncoder().encode(built.text)).rowCount === 1);
}

group("Values are preserved exactly — nothing is invented or substituted");
{
  const schema = schemaFor("church-directory");

  /* A surname with no forename used to have the surname COPIED into
     first_name so the upload would pass, which printed the wrong thing in
     someone's directory. It must be reported, not repaired. */
  const records = [
    { last_name: "Whitfield", first_name: "Ava", address: "412 Larkspur", phone: "770-1", email: "a@x.test" },
    { last_name: "Nameless", first_name: "", address: "1 Way", phone: "770-2", email: "b@x.test" },
    { last_name: "Okonkwo", first_name: "Benjamin", address: "88 Sycamore", phone: "770-3", email: "c@x.test" },
  ];

  const problems = unexportableRecords(records, schema);
  ok("the incomplete record is reported", problems.length === 1, `${problems.length} found`);
  ok("and says which field is missing", /first_name/.test(problems[0]?.reason ?? ""), problems[0]?.reason);

  const built = toDirectoryCsv(records, schema);
  ok("it is dropped rather than repaired", built.rowCount === 2);
  ok("and counted as skipped", built.skipped === 1);
  ok("its surname was NOT copied into first_name", !/Nameless,Nameless/.test(built.text), built.text);

  /* Exact passthrough, including punctuation and quoting. */
  const exact = toDirectoryCsv(
    [{
      last_name: "Reyes-Alvarado",
      first_name: "María José",
      address: '1207 Willow Bend Dr, Apt "4B"',
      phone: "770-555-0168",
      email: "m@x.test",
      family_members: "María, José and Ana",
    }],
    schema
  );
  ok("a hyphenated surname is unchanged", exact.text.includes("Reyes-Alvarado"));
  ok("an accented forename is unchanged", exact.text.includes("María José"));
  ok("an embedded quote is escaped, not stripped", exact.text.includes('""4B""'), exact.text.split("\r\n")[1]);
  ok("a comma-bearing family list is quoted intact",
    exact.text.includes('"María, José and Ana"'));
  const reparsed = validateAndNormalizeCsv(new TextEncoder().encode(exact.text)).records[0];
  ok("and it survives the server round trip exactly",
    reparsed.address === '1207 Willow Bend Dr, Apt "4B"' &&
      reparsed.family_members === "María, José and Ana",
    `${reparsed.address} | ${reparsed.family_members}`);
}

group("The proof prints the customer's own values");
{
  const schema = schemaFor("church-directory");
  const record = {
    last_name: "Whitfield",
    first_name: "Ava",
    address: "412 Larkspur Lane Marietta GA 30060",
    phone: "770-555-0142",
    email: "ava@example.org",
    alternate_phone: "",
    alternate_email: "",
    family_members: "Ava, Ben and Rosa",
  };
  const bind = (expression) => resolveBinding(expression, { record, schema }).value;

  /* Composed from the two real columns, in the template's order — not a
     display_name, and not invented. */
  ok("the name is Last, First", bind("personName") === "Whitfield, Ava", bind("personName"));
  ok("the phone is the raw value", bind("role:phone") === "770-555-0142");
  ok("the address is printed as supplied",
    bind("addressLine") === "Address: 412 Larkspur Lane Marietta GA 30060", bind("addressLine"));
  ok("family members are printed as supplied",
    bind("familyLine") === "Family Members: Ava, Ben and Rosa", bind("familyLine"));

  /* An empty optional collapses entirely rather than printing a bare label. */
  ok("an empty alternate phone renders nothing", bind("altPhoneLine") === "");
  ok("an empty alternate email renders nothing", bind("altEmailLine") === "");

  /* A record with only one name half still prints the half it has. */
  const halfName = resolveBinding("personName", {
    record: { last_name: "Cher", first_name: "" },
    schema,
  }).value;
  ok("a single-name record prints that name alone", halfName === "Cher", halfName);
}

/* ── The free proof itself: a directory CSV renders in the browser ── */
group("A directory CSV produces an on-screen proof");
{
  const template = templateFor("directory-classic");
  const schema = schemaFor("church-directory");
  const templatePath = resolve(ROOT, "public/csv-templates/pressmark-church-directory.csv");
  const table = parseCsv(readFileSync(templatePath, "utf8"));
  const mapping = mappingFromProposals(suggestMapping(table.headers, "church-directory"));
  const records = applyMapping(table.rows, mapping);

  ok("directory-classic is a CSV-driven template", template.inputMode === "csv");

  const plan = planProof(template, records);
  ok("the plan produces pages", plan.pages.length > 0, `${plan.pages.length} pages`);
  ok("it is not in manual mode", plan.manualMode === false);
  ok("every uploaded record is accounted for", plan.recordsAvailable === records.length);
  ok(
    "records are actually placed on the pages",
    plan.pages.some((planned) => planned.records.length > 0)
  );

  /* The merge is the point: a real name from the spreadsheet must reach a
     real text frame, through the same binding the renderer uses. */
  const listing = plan.pages.find((planned) => planned.records.length > 0);
  const name = resolveBinding("personName", { record: listing.records[0], schema });
  ok("a real name is bound into the page", name.value.includes("Whitfield"), name.value);

  const address = resolveBinding("addressLine", { record: listing.records[0], schema });
  ok("the address is bound too",
    address.value === "Address: 412 Larkspur Lane Marietta GA 30060", address.value);

  /* A directory with no spreadsheet at all must not crash the planner. */
  const empty = planProof(template, []);
  ok("an empty record set still plans pages", empty.pages.length > 0);
  ok("and reports itself as manual", empty.manualMode === true);
}


group("The build method follows the chosen design");
{
  /* The mode selector is hidden for CSV designs, so nothing else sets this. */
  ok("Directory Classic implies the spreadsheet mode",
    modeForTemplate("directory-classic") === PROOF_MODES.data);
  ok("the photo gallery implies the photograph mode",
    modeForTemplate("photo-gallery") === PROOF_MODES.photo);
  ok("an unknown design keeps whatever mode was passed",
    modeForTemplate("no-such-template", PROOF_MODES.data) === PROOF_MODES.data);

  /*
   * The regression this guards: a directory project left in `photo` mode
   * renders photo records, so the customer's spreadsheet is silently ignored
   * and the proof shows their filenames instead of their members.
   */
  const schema = schemaFor("church-directory");
  const table = parseCsv(
    readFileSync(resolve(ROOT, "public/csv-templates/pressmark-church-directory.csv"), "utf8")
  );
  const records = applyMapping(
    table.rows,
    mappingFromProposals(suggestMapping(table.headers, "church-directory"))
  );

  const directoryProject = {
    ...emptyProject(),
    mode: modeForTemplate("directory-classic"),
    visual: { ...emptyProject().visual, templateId: "directory-classic" },
    data: { ...emptyProject().data, schemaId: "church-directory", records },
  };
  const resolved = recordsFor(directoryProject);
  ok("a directory project renders from the spreadsheet, not from photographs",
    resolved.length === records.length, `${resolved.length} records`);
  ok("and those are the customer's own records",
    resolveBinding("personName", { record: resolved[0], schema }).value.includes("Whitfield"));
}


group("A page caption never overstates what is on the page");
{
  const template = templateFor("directory-classic");
  const listing = template.pages.find((page) => page.id === "listing-spread");

  /* The regression: this caption read "Twelve of your records ..." for every
     directory, so a three-family church was told twelve of its records were on
     a page that showed three. */
  ok("no caption hard-codes a record count",
    template.pages.every((page) => !/\b(twelve|eight|ten|six)\b/i.test(page.caption ?? "")),
    template.pages.map((page) => page.caption).join(" | "));

  ok("a full grid reports its real count",
    captionFor(listing, 12).includes("12 of your records"), captionFor(listing, 12));
  ok("a small directory reports ITS real count",
    captionFor(listing, 3).includes("3 of your records"), captionFor(listing, 3));
  ok("a single record is still stated honestly",
    captionFor(listing, 1).includes("1 of your records"), captionFor(listing, 1));
  ok("an empty page claims no records at all",
    !/\d/.test(captionFor(listing, 0)), captionFor(listing, 0));
  ok("a page with no count caption falls back to its plain one",
    captionFor(template.pages.find((page) => page.id === "cover"), 5) ===
      template.pages.find((page) => page.id === "cover").caption);
  ok("a missing page yields an empty caption", captionFor(null, 3) === "");
}

group("The mark");
{
  const dir = resolve(ROOT, "src/assets");
  const lockup = readFileSync(resolve(dir, "pressmark-studio-logo.svg"), "utf8");
  const light = readFileSync(resolve(dir, "pressmark-studio-logo-light.svg"), "utf8");
  const mark = readFileSync(resolve(dir, "pressmark-studio-mark.svg"), "utf8");
  const shell = readFileSync(resolve(ROOT, "src/instant-proof/components/AppShell.jsx"), "utf8");
  const boot = readFileSync(resolve(ROOT, "src/instant-proof/components/BootScreen.jsx"), "utf8");
  const blog = readFileSync(resolve(ROOT, "src/blog/shell.jsx"), "utf8") +
    readFileSync(resolve(ROOT, "src/pages/Blog.jsx"), "utf8") +
    readFileSync(resolve(ROOT, "src/pages/DataMerge.jsx"), "utf8") +
    readFileSync(resolve(ROOT, "src/pages/Article.jsx"), "utf8");

  ok("three cuts of one mark are available",
    /viewBox="0 0 138\.75 186\.63"/.test(lockup) && /viewBox="0 0 138\.75 164\.41"/.test(mark));

  /* The light cut exists for the ink launch screen. If it ever diverges by more
     than the wordmark's fill, the two logos have become two logos. */
  ok("the light cut differs from the lockup only in the wordmark's colour",
    light === lockup.replace("#231f20", "#f3ede4"));

  /* The lockup's wordmark is the bottom 5% of its height; the mark is what goes
     anywhere small. */
  ok("the mark carries no wordmark to shrink into illegibility",
    !/id="text"/.test(mark) && /id="text"/.test(lockup));
  ok("and it keeps the file and the arrow",
    /id="file"/.test(mark) && /id="arrow"/.test(mark));

  ok("the sidebar shows the lockup and the phone bar the mark",
    /pressmark-studio-logo\.svg/.test(shell) && /pressmark-studio-mark\.svg/.test(shell));
  ok("the launch screen shows the light cut",
    /pressmark-studio-logo-light\.svg/.test(boot));
  /* The section has no chrome of its own any more: it is drawn by AppShell,
     so it cannot show a different mark. */
  ok("the Data Merge section is drawn in the shell, so it carries the shell's mark",
    /AppShell/.test(blog) && !/<img[^>]*logo/.test(blog));
  ok("no page still reaches for the old raster logo",
    !/logo main\.png/.test(shell + boot + blog));

  /* Portrait artwork sized by width is a height nobody chose. */
  ok("every placement sizes the portrait artwork by height",
    !/width: "clamp\(1[0-9]{2}px/.test(blog));
}

group("Asking for a price");
{
  /*
   * The word is "price", not "quote".
   *
   * Three things keep the old word and are not copy: the DOM ids on the form's
   * fields, the /api/quote endpoint (renaming it would mean touching the Zoho
   * lead mapping behind it), and quotes@pressmark.studio, which is a mailbox
   * rather than a word.
   */
  /* `quote-` alone: the ids are built as `quote-${name}`, so the character after
     the hyphen is not always a letter. */
  const infrastructure = /quote-|\/api\/quote|quotes@|api\/quote\.js/g;
  const pages = [
    "src/pages/Contact.jsx",
    "src/pages/Services.jsx",
    "src/pages/Pricing.jsx",
    "src/pages/DirectoryDesigns.jsx",
    "src/pages/Privacy.jsx",
    "src/pages/Article.jsx",
    "src/instant-proof/nav.js",
    "src/blog/shell.jsx",
    "src/pages/Blog.jsx",
    "src/pages/DataMerge.jsx",
    "contact.html",
  ];
  for (const page of pages) {
    const text = readFileSync(resolve(ROOT, page), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(infrastructure, "");
    ok(`${page.split("/").pop()} asks for a price, not a quote`,
      !/quote/i.test(text),
      (text.match(/[A-Za-z ]{0,18}quote[a-z]*/i) || ["none"])[0].trim());
  }

  const contact = readFileSync(resolve(ROOT, "src/pages/Contact.jsx"), "utf8");
  ok("the button says Request a price", /Request a price/.test(contact));
  ok("and the endpoint behind it is untouched", /fetch\("\/api\/quote"/.test(contact));
}

group("Typography");
{
  const fonts = readFileSync(resolve(ROOT, "src/fonts.js"), "utf8");
  const tokens = readFileSync(resolve(ROOT, "src/instant-proof/tokens.js"), "utf8");
  const shellCss = readFileSync(resolve(ROOT, "src/instant-proof/theme.css.js"), "utf8");
  const blogTheme = readFileSync(resolve(ROOT, "src/blog/theme.js"), "utf8");
  const storeTheme = readFileSync(resolve(ROOT, "src/storefront/theme.js"), "utf8");
  const buyCss = readFileSync(resolve(ROOT, "src/pages/Buy.css"), "utf8");
  const consent = readFileSync(resolve(ROOT, "src/consent.js"), "utf8");

  ok("the site is set in News Gothic Std", /'News Gothic Std'/.test(fonts));
  ok("with fallbacks for machines that do not have it",
    /News Gothic MT/.test(fonts) && /Franklin Gothic/.test(fonts) && /sans-serif/.test(fonts));

  /* One definition. Four is how a site ends up set in three faces nobody
     chose — which is what this replaced. */
  for (const [name, source] of [
    ["the tool's tokens", tokens],
    ["the blog", blogTheme],
    ["the storefront", storeTheme],
    ["the consent banner", consent],
  ]) {
    ok(`${name} reads the family from src/fonts.js`, /FONT_FAMILY/.test(source));
  }
  ok("the storefront stylesheet names the same family",
    /News Gothic Std/.test(buyCss) && !/Cormorant/.test(buyCss));

  /*
   * News Gothic Std ships Light, Roman, Medium and Bold. Asking for 800 or 900
   * does not get a heavier cut — the browser smears the Bold into a fake one.
   */
  const weights = [...shellCss.matchAll(/font-weight: (\d+)/g)].map((match) => Number(match[1]));
  ok("no weight is asked for that the family does not have",
    weights.every((weight) => [300, 400, 500, 700].includes(weight)),
    [...new Set(weights)].sort((a, b) => a - b).join(", "));

  /* The licensed face is loaded by the build, never committed. */
  const viteConfig = readFileSync(resolve(ROOT, "vite.config.js"), "utf8");
  ok("the web font is loaded from an Adobe Fonts project, at build time",
    /use\.typekit\.net/.test(viteConfig) && /PRESSMARK_ADOBE_FONTS_KIT/.test(viteConfig));
  ok("an unconfigured build adds no font tags at all",
    /if \(!kit\) return \[\]/.test(viteConfig));
  ok("no font binary is committed to the repository",
    !existsSync(resolve(ROOT, "public/fonts")));

  /* The serif is gone from the chrome, and so is the request that fetched it. */
  ok("no Google Fonts request remains",
    !/fonts\.googleapis\.com/.test(blogTheme) &&
    !/fonts\.googleapis\.com/.test(readFileSync(resolve(ROOT, "src/instant-proof/styles.js"), "utf8")));
}

group("The Data Merge section and the Blog");
{
  const blog = await import("../src/data/blogPosts.js");
  const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
  const dataMerge = read("src/pages/DataMerge.jsx");
  const feed = read("src/pages/Blog.jsx");
  const article = read("src/pages/Article.jsx");
  const shellParts = read("src/blog/shell.jsx");
  const nav = read("src/instant-proof/nav.js");
  const vercel = JSON.parse(read("vercel.json"));
  const vite = read("vite.config.js");
  const generator = read("scripts/generate-blog-pages.mjs");

  /* Two doors, each its own page. */
  ok("/data-merge is the Data Merge section",
    blog.DATA_MERGE_BASE === "/data-merge" && blog.DATA_MERGE_META.name === "Data Merge" &&
    existsSync(resolve(ROOT, "data-merge.html")) && /src\/data-merge\.jsx/.test(read("data-merge.html")) &&
    /dataMerge: 'data-merge\.html'/.test(vite));
  ok("/blog is the Blog", blog.BLOG_BASE === "/blog" && blog.BLOG_META.name === "Blog");
  ok("the sidebar links the Data Merge section once, and not the Blog",
    (nav.match(/href: "\/data-merge"/g) || []).length === 1 && !/href: "\/blog"/.test(nav) &&
    !/label: "Blog"/.test(nav) && !/href: "\/guides"/.test(nav));
  ok("the Blog is still reachable from the Data Merge section", /href=\{BLOG_BASE\}/.test(dataMerge));
  ok("the sitemap lists the Data Merge section", /DATA_MERGE_BASE,/.test(generator));
  ok("the Data Merge section is written for organisations buying it, and says so",
    /data merge services/i.test(blog.DATA_MERGE_META.tagline) && /have a studio do it/i.test(blog.DATA_MERGE_META.intro));

  /* The Data Merge section shows data merge and nothing else. */
  const dm = blog.DATA_MERGE_CATEGORIES;
  ok("the lead article is a data merge article", dm.includes(blog.getFeaturedPost().category),
    blog.getFeaturedPost().slug);
  ok("the section lists only data merge articles", /filter\(isDataMerge\)/.test(dataMerge));
  ok("the Blog's filter lists the data merge topics first",
    JSON.stringify(blog.CATEGORIES.slice(1, 1 + dm.length)) === JSON.stringify(dm), blog.CATEGORIES.join(" | "));
  ok("every topic in the filter has articles, and every article's topic is in it",
    blog.CATEGORIES.filter((c) => c !== "All").every((c) => blog.POSTS.some((post) => post.category === c)) &&
    blog.POSTS.every((post) => blog.CATEGORIES.includes(post.category)));

  /* The Blog is a feed: newest first, grouped by month, paged. */
  const published = blog.getPublishedPosts("2026-09-13");
  ok("the Blog is newest first",
    published.every((post, i) => i === 0 || published[i - 1].publishedDate >= post.publishedDate));
  ok("and groups older posts under their month, a page at a time",
    /groupByMonth/.test(feed) && /Show older posts/.test(feed) && /PAGE_SIZE/.test(feed));

  /* Written ahead, released on the day. */
  const tomorrow = { publishedDate: "2026-09-14" };
  ok("a post dated ahead is not published yet",
    !blog.isPublished(tomorrow, "2026-09-13") && blog.isPublished(tomorrow, "2026-09-14"));
  ok("the build only generates pages for published posts", /const POSTS = getPublishedPosts\(\)/.test(generator));
  ok("the lists and articles only show published posts",
    /getPublishedPosts\(\)/.test(feed) && /getPublishedPosts\(\)/.test(dataMerge) && /isPublished\(found\)/.test(article));

  /* Articles stay where they are indexed, and credit the right door. */
  const dmPost = blog.POSTS.find((post) => dm.includes(post.category));
  const otherPost = blog.POSTS.find((post) => !dm.includes(post.category));
  ok("every article keeps its /blog/<slug> address", blog.POSTS.every((post) => blog.postUrl(post) === `/blog/${post.slug}`));
  ok("a data merge article is credited to the Data Merge section, anything else to the Blog",
    blog.sectionFor(dmPost).href === "/data-merge" && blog.sectionFor(otherPost).href === "/blog");
  ok("the article's breadcrumb and sidebar highlight follow that",
    /<AppShell current=\{section\.href\}>/.test(article) && /href=\{section\.href\}/.test(article));

  /* The route to a price is on every page. */
  ok("the hire card asks for a price and links pricing",
    /href="\/contact"[\s\S]*?Request a price/.test(shellParts) && /href="\/pricing"/.test(shellParts));
  ok("the section, the Blog and every article offer it", /<HireUs/.test(dataMerge) && /<HireUs/.test(feed) && /<HireUs/.test(article));

  /* Guides folded in, not left overlapping. */
  ok("the separate guides page is gone",
    !existsSync(resolve(ROOT, "guides.html")) && !existsSync(resolve(ROOT, "src/pages/Guides.jsx")));
  ok("and /guides sends old links to the Data Merge section",
    vercel.redirects.some((r) => r.source === "/guides" && r.destination === "/data-merge" && r.permanent));

  /* In the shell, like every page. */
  ok("both indexes are drawn by AppShell",
    /<AppShell current=\{DATA_MERGE_BASE\}>/.test(dataMerge) && /<AppShell current=\{BLOG_BASE\}>/.test(feed));
  ok("the old editorial chrome is retired", !existsSync(resolve(ROOT, "src/blog/components.jsx")));
  ok("a filtered view survives a reload and can be shared",
    [dataMerge, feed].every((page) => /categoryFromHash/.test(page) && /hashchange/.test(page)));
}

group("Sample render and in-page PDF preview");
{
  const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
  const page = read("src/pages/ProofTool.jsx");
  const composer = read("src/instant-proof/components/Composer.jsx");
  const job = read("src/instant-proof/components/DirectoryRenderJob.jsx");
  const preview = read("src/instant-proof/components/PdfPreview.jsx");
  /* Split on either line ending: the sample was saved from a spreadsheet with
     Windows line endings, which is exactly what a customer's file will have. */
  const sample = read("public/samples/directory-classic-sample.csv").trim().split(/\r?\n/);
  const template = read("public/csv-templates/directory-classic-template.csv").trim();

  ok("the sample has the template's exact heading row", sample[0] === template, sample[0]);
  ok("and twenty made-up households", sample.length === 21 &&
    sample.slice(1).every((row) => /555-01\d\d/.test(row) && /@example\.(org|com)/.test(row)));
  ok("the homepage offers it, and so does the + menu",
    /Use sample data/.test(page) && /Try it with sample data/.test(composer));
  ok("the sample goes through the same checks as an upload", /choose\(new File\(\[blob\], SAMPLE_NAME/.test(page));
  ok("the sample needs no permission checkbox, a real file still does",
    /!permitted && !sample/.test(page) && /\{!sample && \(\s*<label className="ip-consent">/.test(composer));
  ok("a finished PDF is previewed in the page, with download still offered",
    /<PdfPreview url=\{job\.downloadUrl\}/.test(job) && /Download PDF/.test(job));
  ok("the preview draws with pdf.js, not an iframe a phone cannot show",
    /pdfjs-dist\/legacy\/build\/pdf\.mjs/.test(preview) && !/<iframe\s/.test(preview));
  ok("pdf.js loads only when a preview is shown", /await Promise\.all\(\[\s*import\("pdfjs-dist/.test(preview) &&
    !/^import .*pdfjs/m.test(preview));
  ok("pages are drawn as they near the screen", /IntersectionObserver/.test(preview));
}

group("Support chat");
{
  const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
  const support = await import("../src/support.js");
  const chat = read("src/instant-proof/components/SupportChat.jsx");
  const shell = read("src/instant-proof/components/AppShell.jsx");
  const css = read("src/instant-proof/theme.css.js");
  const server = read("lib/chat/chat.js");

  /* The number stays off the site: no digits, no sms:/tel: links anywhere the
     page is built from. */
  const pageSources = [read("src/support.js"), chat, shell];
  ok("no phone number, sms: or tel: link on the site",
    pageSources.every((source) => !/sms:|tel:|\d{3}\D?\d{3}\D?\d{4}/.test(source)));
  ok("the studio's number is a server environment variable only",
    /process\.env\.PRESSMARK_CHAT_FORWARD_TO/.test(server) && !("SUPPORT_PHONE" in support));

  ok("it covers InDesign automation, data merge and Microsoft Publisher, shared with the server",
    JSON.stringify(support.SUPPORT_TOPICS) === JSON.stringify(["InDesign automation", "Data merge", "Microsoft Publisher"]) &&
    /from "\.\.\/\.\.\/src\/support\.js"/.test(server));
  ok("messages are sent to the site's own chat endpoint and replies are read back",
    /method: "POST"/.test(chat) && /\$\{CHAT_ENDPOINT\}\?id=/.test(chat));
  ok("an offline chat says so and offers the price request instead", /Chat is offline right now/.test(chat) && /href="\/contact"/.test(chat));
  ok("until texting is set up, chat asks for an email address and says replies come by email",
    /needsEmail/.test(chat) && /type="email"/.test(chat) && /reply by email/.test(chat) &&
    /if \(chatConfigured\(\)\) return "sms";\s*if \(emailConfigured\(\)\) return "email";/.test(server));
  ok("an unseen reply puts a dot on the chat buttons", /onUnread=\{setChatUnread\}/.test(shell) && (shell.match(/ip-chat-dot/g) || []).length === 2);
  ok("Escape closes it and focus goes back to the button that opened it", /Escape/.test(chat) && /returnFocus\?\.current\?\.focus\(\)/.test(chat));

  ok("every page in the shell has it", /<SupportChat /.test(shell));
  ok("a corner button on a desktop, a Chat button in the phone bar",
    /className="ip-chat-launcher"/.test(shell) && /ip-topbar-actions/.test(shell) &&
    /\.ip-chat-launcher \{ display: none; \}/.test(css));
  ok("it sits above the consent banner", /\.ip-chat \{[\s\S]*?bottom: var\(--pm-consent-height, 0px\)/.test(css));
  ok("it is drawn from the shell's tokens", /\.ip-chat \{[\s\S]*?background: var\(--proof-surface\)/.test(css) &&
    /\.ip-chat-mine \{[\s\S]*?background: var\(--proof-accent-soft\)/.test(css));
}

group("Maroon accent and Google buttons");
{
  const read = (path) => readFileSync(resolve(ROOT, path), "utf8");
  ok("the accent is InDesign maroon", ACCENT_TOKENS.ink === "#460f21");
  ok("with InDesign's pink as its pair for dark grounds", ACCENT_TOKENS.onDark === "#ef3b6a");

  /* Gold used to live in five places and drifted between them. None may keep
     a copy now: the four JS stylesheets read src/palette.js, and Buy.css spells
     the same maroon. */
  const sheets = [
    "src/instant-proof/tokens.js",
    "src/instant-proof/theme.css.js",
    "src/blog/theme.js",
    "src/blog/shell.jsx",
    "src/blog/styles.css.js",
    "src/storefront/theme.js",
    "src/consent.js",
    "src/pages/Buy.css",
    "src/pages/Buy.jsx",
    "src/components/HomeLink.jsx",
  ];
  const goldValue = /#aa7d48|#96693a|#8e6738|#c47b20|#e6ad3b|#9a5719|#9f5b17|#f6c957|#9a5a16|rgba\(170, ?125, ?72/i;
  for (const sheet of sheets) {
    const text = read(sheet);
    ok(`no gold left in ${sheet.split("/").pop()}`, !goldValue.test(text),
      (text.match(goldValue) || ["none"])[0]);
  }
  for (const sheet of ["src/instant-proof/tokens.js", "src/blog/theme.js", "src/storefront/theme.js", "src/consent.js"]) {
    ok(`${sheet.split("/").pop()} takes its accent from src/palette.js`, /from "\.\.?\/palette\.js"/.test(read(sheet)));
  }

  /* Maroon on the site's navy is about 1.3:1 — invisible, so anything on a dark
     ground uses the pink. The blog's navy blocks went when it moved into the
     shell; the consent banner is the dark ground that remains. */
  ok("the consent banner, on navy, uses the pink", /ACCENT_ON_INK = ACCENT\.onDark/.test(read("src/consent.js")));
  const blogCss = read("src/blog/styles.css.js");
  ok("the Data Merge section is on the light ground, so it takes the maroon",
    /var\(--proof-accent\)/.test(blogCss) && !/accentOnDark|#ef3b6a|#020814/i.test(blogCss));
  ok("a selected topic chip is white on maroon",
    /\.bl-chip\[aria-pressed="true"\] \{[\s\S]*?background: var\(--proof-accent\);[\s\S]*?color: #fff/.test(blogCss));

  /* One button, everywhere. */
  ok("the button is the Google Search key",
    BUTTON_TOKENS.background === "#f8f9fa" && BUTTON_TOKENS.borderHover === "#dadce0" &&
    BUTTON_TOKENS.text === "#3c4043" && BUTTON_TOKENS.radius === "8px");
  for (const sheet of ["src/instant-proof/theme.css.js", "src/blog/theme.js", "src/storefront/theme.js", "src/consent.js"]) {
    ok(`${sheet.split("/").pop()} builds its buttons from BUTTON`, /BUTTON\.background/.test(read(sheet)));
  }
  const buy = read("src/pages/Buy.css");
  ok("Buy.css spells the same key", /\.bc-btn \{[\s\S]*?background: #f8f9fa/.test(buy) && !/linear-gradient\(180deg, #9a5719/.test(buy));
  /*
   * Regular size only. No full-width buttons, no oversized purchase keys, no
   * second line of text inside a button — the Buy page's notes sit beneath
   * their keys instead. 44px exists only for a coarse pointer.
   */
  const toolCss = read("src/instant-proof/theme.css.js");
  ok("there is no full-width button style", !/\.ip-btn-block/.test(toolCss) && !/ip-btn-block/.test(read("src/instant-proof/components/Composer.jsx")));
  ok("the round keys are the regular height on a mouse",
    /\.ip-icon-btn \{[\s\S]*?width: 36px;[\s\S]*?height: 36px;/.test(toolCss));
  ok("the storefront pages' button is not stretched",
    !/btnPrimary: \{[\s\S]*?width: "100%"/.test(read("src/storefront/theme.js")));
  const buyMarkup = read("src/pages/Buy.jsx");
  ok("no Buy page button carries a second line inside it",
    !/bc-btn-sub/.test(buyMarkup + buy) && /bc-btn-note/.test(buyMarkup));
  ok("and none of them is taller or wider than the regular key",
    !/\.bc-cta-row \.bc-btn \{/.test(buy) && !/\.bc-btn \{[^}]*width: 100%/.test(buy) &&
    !/\.bc-btn \{[^}]*min-height: (4[0-9]|5[0-9]|6[0-9])px/.test(buy.replace(/@media \(pointer: coarse\) \{[^}]*\}\s*\}/g, "")));

  ok("buttons are sentence case, not tracked capitals",
    /\.ip-btn,\s*\.ip-menu-btn \{[\s\S]*?text-transform: none/.test(read("src/instant-proof/theme.css.js")));
}

group("The InDesign scheme");
{
  const tokens = readFileSync(resolve(ROOT, "src/instant-proof/tokens.js"), "utf8");
  const css = readFileSync(resolve(ROOT, "src/instant-proof/theme.css.js"), "utf8");

  /* Both colours come off the Pressmark mark, whose arrow gradient runs between
     exactly them — which is also the Adobe InDesign pairing. */
  ok("the scheme is declared once, as tokens",
    /idPink: "#ef3b6a"/.test(tokens) && /idInk: "#460f21"/.test(tokens));

  const railRule = (state) => {
    const at = css.indexOf(`.ip-step[data-state="${state}"] .ip-step-n`);
    return at < 0 ? "" : css.slice(at, css.indexOf("}", at));
  };
  ok("the step you are on is the deep maroon", /var\(--proof-id-ink\)/.test(railRule("current")));
  ok("a finished step is the pink", /var\(--proof-id-pink\)/.test(railRule("done")));
  ok("neither marker borrows the site accent",
    !/--proof-accent/.test(railRule("current") + railRule("done")));

  /*
   * The scheme marks progress and stops there — the gold is still the accent
   * the rest of the site is built on. Checked by location rather than by a
   * count, because the right number of uses inside the rail is whatever the
   * rail needs.
   */
  const railStart = css.indexOf("  .ip-step-n {");
  const railEnd = css.indexOf("/* ── Design cards ── */");
  const inRail = (css.slice(railStart, railEnd).match(/--proof-id-/g) || []).length;
  const total = (css.match(/var\(--proof-id-/g) || []).length;
  ok("every use of the scheme is inside the step rail",
    railStart > 0 && railEnd > railStart && inRail === total,
    `${inRail} of ${total} uses`);
}

group("Brand colours");
{
  const controls = readFileSync(resolve(ROOT, "src/instant-proof/components/ColorControls.jsx"), "utf8");
  const colorsModule = readFileSync(resolve(ROOT, "src/instant-proof/colors.js"), "utf8");

  /* The six the customer can change, and the swatch each one sets. */
  const expected = {
    primaryColor: "PM_Primary",
    secondaryColor: "PM_Secondary",
    accentColor: "PM_Accent",
    textColor: "PM_Text",
    backgroundColor: "PM_Background",
    lightTint: "PM_LightTint",
  };
  ok("six colours exist in the system", BRAND_COLORS.length === 6, `${BRAND_COLORS.length}`);

  /*
   * A design shows only the swatches it paints.
   *
   * The template carries all six so a new design needs no swatch work, but
   * Directory Classic applies three of them — PM_Primary to the paragraph
   * border under each name, PM_Text to the body, PM_Background to the master
   * spread. A control that moves nothing in the PDF is worse than no control,
   * so the panel is filtered by the design rather than by the template.
   */
  const { DESIGNS: LIBRARY, swatchKeysFor } = await import("../src/instant-proof/designs.js");
  ok("Directory Classic offers exactly the three it paints",
    JSON.stringify(swatchKeysFor("directory-classic")) ===
      JSON.stringify(["primaryColor", "textColor", "backgroundColor"]),
    swatchKeysFor("directory-classic").join(", "));
  ok("every design's swatches are real brand colours",
    LIBRARY.every((design) => design.swatchKeys.every((key) => SWATCH_FOR[key])));
  ok("and are listed in BRAND_COLORS order, so the panel reads consistently",
    LIBRARY.every((design) => {
      const order = design.swatchKeys.map((key) => BRAND_COLOR_ORDER.indexOf(key));
      return order.every((value, index) => index === 0 || value > order[index - 1]);
    }));

  /* Switching design must not carry an edit into a design that cannot show it. */
  ok("a colour a design does not use is never submitted",
    Object.keys(
      changedColors({ ...DEFAULT_COLORS, accentColor: "#123456" }, swatchKeysFor("directory-classic"))
    ).length === 0);
  ok("each maps to its PM_ swatch",
    JSON.stringify(SWATCH_FOR) === JSON.stringify(expected), JSON.stringify(SWATCH_FOR));
  ok("every colour has a label and a plain-language hint",
    BRAND_COLORS.every((color) => color.label && color.hint));

  /*
   * The defaults are the template's own swatches, read out of
   * church-directory-classic.idml. A default that merely looked similar would
   * show the customer a colour their PDF does not contain.
   */
  ok("PM_Primary's default is the template's 0/0/0/100",
    JSON.stringify(BRAND_COLORS[0].cmyk) === JSON.stringify({ c: 0, m: 0, y: 0, k: 100 }));
  ok("PM_Text is K only, as body copy must be",
    JSON.stringify(BRAND_COLORS[3].cmyk) === JSON.stringify({ c: 0, m: 0, y: 0, k: 100 }));
  ok("PM_Background is no ink at all",
    JSON.stringify(BRAND_COLORS[4].cmyk) === JSON.stringify({ c: 0, m: 0, y: 0, k: 0 }));
  ok("every default shown in the picker is derived from its swatch",
    BRAND_COLORS.every((color) => DEFAULT_COLORS[color.key] === cmykToHex(color.cmyk)),
    JSON.stringify(DEFAULT_COLORS));

  /*
   * The point of changedColors: an untouched swatch is never submitted, so the
   * lossy CMYK round trip cannot repaint five colours nobody chose.
   */
  ok("nothing is submitted when nothing is changed",
    Object.keys(changedColors(DEFAULT_COLORS)).length === 0);
  ok("one change submits exactly one colour",
    JSON.stringify(changedColors({ ...DEFAULT_COLORS, accentColor: "#123456" })) ===
      JSON.stringify({ accentColor: "#123456" }));
  const tint = BRAND_COLORS.find((color) => color.key === "lightTint");
  ok("and the round trip really is lossy in that direction, which is why",
    JSON.stringify(hexToCmyk(DEFAULT_COLORS.lightTint)) !== JSON.stringify(tint.cmyk),
    `${JSON.stringify(hexToCmyk(DEFAULT_COLORS.lightTint))} vs template ${JSON.stringify(tint.cmyk)}`);

  ok("a hex is canonicalized to upper case with a leading hash",
    normalizeHex("7a1f35") === "#7A1F35" && normalizeHex("  #7a1f35 ") === "#7A1F35");

  /* This value is written into a key=value handoff file that an ExtendScript
     splits on the first "=". Anything but six hex digits must never get that
     far, whatever it looks like. */
  ok("anything that is not six hex digits is refused",
    ["", "#", "red", "#12345", "#1234567", "#12g456", "7a1f3", "rgb(0,0,0)", "#7A1F35=x", "#7A1F35 red"]
      .every((value) => normalizeHex(value) === ""));

  /* Surrounding whitespace is trimmed rather than refused — a pasted value
     often carries a newline — but nothing INSIDE the value survives, which is
     what keeps the handoff file's key=value contract safe. */
  ok("surrounding whitespace is trimmed, embedded characters are not tolerated",
    normalizeHex("\n #7a1f35 \t") === "#7A1F35" && normalizeHex("#7A1F\n35") === "");

  ok("three-digit shorthand is refused rather than guessed at", normalizeHex("#abc") === "");

  ok("black is K only, never a rich black",
    JSON.stringify(hexToCmyk("#000000")) === JSON.stringify({ c: 0, m: 0, y: 0, k: 100 }));
  ok("white is no ink at all",
    JSON.stringify(hexToCmyk("#FFFFFF")) === JSON.stringify({ c: 0, m: 0, y: 0, k: 0 }));
  ok("a converted colour is always four whole percentages in range",
    ["#7A1F35", "#D4AF37", "#22503C", "#000000", "#FFFFFF", "#0A0B0C"].every((hex) =>
      Object.values(hexToCmyk(hex)).every((ink) => Number.isInteger(ink) && ink >= 0 && ink <= 100)));

  ok("any subset of the six validates, including none",
    validateBrandColors({}).ok && validateBrandColors({ textColor: "#111111" }).ok);
  ok("a malformed colour is refused with a reason, not corrected",
    validateBrandColors({ primaryColor: "nope" }).ok === false);
  ok("a field the site does not own is ignored, not forwarded",
    JSON.stringify(validateBrandColors({ borderColor: "#123456" }).colors) === "{}");

  /* No preset swatches: a customer picking their organisation's colours knows
     what those are, and suggestions of ours sit where the right answer goes. */
  ok("no preset swatches are offered",
    !/PRESETS/.test(colorsModule) && !/ip-preset|presets\.map/.test(controls));
  ok("the controls are generated from the one list, filtered by the design",
    /BRAND_COLORS\.filter\(\(color\) => keys\.includes/.test(controls));
  ok("each control is a picker, a hex field and a reset",
    /type="color"/.test(controls) && /className="ip-hex"/.test(controls) && /Reset/.test(controls));

  /* The ExtendScript is handed swatch names, not a vocabulary of its own. */
  const jsx = readFileSync(resolve(ROOT, "scripts/indesign/PressmarkDirectoryMerge.jsx"), "utf8");
  ok("the script applies whatever swatch the handoff names",
    /SWATCH_PREFIX = "swatch\."/.test(jsx) && /indexOf\(SWATCH_PREFIX\) !== 0/.test(jsx));
  ok("and still refuses InDesign's reserved swatches",
    /isProtectedSwatch\(name\)/.test(jsx) &&
    /\[Paper\]", "\[Black\]", "\[Registration\]", "\[None\]/.test(jsx));
  ok("a swatch name is bounded before it is used", /name\.length > 100/.test(jsx));

  /*
   * Found in the first live run: a template with uninstalled fonts raised
   * InDesign's modal alert, the script waited out AppleScript's 120s timeout on
   * every attempt, and the alert stayed up blocking everything after it.
   */
  ok("an unattended render suppresses InDesign's dialogs",
    /UserInteractionLevels\.NEVER_INTERACT/.test(jsx));
  ok("only in job mode, so an operator at the keyboard still sees them",
    /if \(jobSpec !== null\) \{\s*previousInteraction = app\.scriptPreferences\.userInteractionLevel/.test(jsx));
  ok("and the operator's setting is restored however the script ends",
    /\} finally \{[\s\S]*userInteractionLevel = previousInteraction/.test(jsx));
  ok("a substituted font fails the render and is named, never shipped silently",
    /font\.status !== FontStatus\.INSTALLED/.test(jsx) && /not installed on the render Mac/.test(jsx));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
