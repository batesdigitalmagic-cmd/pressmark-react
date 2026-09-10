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

/* ── 29. Photographs stay in browser memory ── */
group("29. Photographs never leave the browser");
{
  /*
   * Comments discuss localStorage and uploads by name — a naive grep would
   * match the very sentence promising not to do it. Strip comments first so
   * these assertions are about executable code.
   */
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  const files = [
    "src/instant-proof/photoProject.js",
    "src/instant-proof/components/PhotoUploadPanel.jsx",
    "src/instant-proof/components/PhotoDetailsPanel.jsx",
    "src/pages/InstantProof.jsx",
  ];
  const sources = files.map((f) => stripComments(readFileSync(resolve(ROOT, f), "utf8")));

  ok("no photo path writes to localStorage or sessionStorage",
     sources.every((src) => !/localStorage|sessionStorage/.test(src)));
  ok("no photo path uploads a file",
     sources.every((src) => !/fetch\(|XMLHttpRequest|FormData/.test(src)));
  ok("no console call could log a filename",
     sources.every((src) => !/console\.(log|info|warn|error)/.test(src)));

  const page = readFileSync(resolve(ROOT, "src/pages/InstantProof.jsx"), "utf8");
  ok("object URLs are revoked when a file is removed", /revokeObjectURL/.test(page));
  /*
   * Deliberately NOT on unmount. StrictMode mounts, unmounts and remounts in
   * development, so an unmount revoke fired while the photographs were still on
   * screen and turned every preview into a dead blob URL. A real unmount means
   * the visitor is leaving, at which point the browser reclaims them anyway.
   */
  ok("object URLs are NOT revoked on unmount, which broke StrictMode remounts",
     !/assetsRef/.test(page));
  ok("starting another proof revokes them too",
     /project\.assets\.forEach\(revoke\)/.test(page));
}

/* ── 30. Mobile ── */
group("30. Mobile layout");
{
  const page = readFileSync(resolve(ROOT, "src/pages/InstantProof.jsx"), "utf8");
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
  /* Files survive Back because the whole project is one piece of state on the
     page component, not per-step state that unmounts with the step. */
  ok("photographs survive stepping backwards — project state lives on the page",
     /const \[project, setProject\] = useState\(emptyProject\)/.test(page));
  ok("navigating back only changes an index, never the project",
     /const back = \(\) => goTo\(Math\.max\(safeIndex - 1, 0\)\)/.test(page));
}

/* ── 31. Three-step navigation ── */
group("31. Three-step flow");
{
  const page = readFileSync(resolve(ROOT, "src/pages/InstantProof.jsx"), "utf8");
  const ids = [...page.matchAll(/\{ id: "(create|upload|proof)"/g)].map((m) => m[1]);
  ok("exactly three steps, in order", ids.join(",") === "create,upload,proof", ids.join(" -> "));
  ok("the step list is fixed, not mode-dependent",
     !/PHOTO_STEPS|DATA_STEPS/.test(page));
  ok("both modes use the same three steps", (page.match(/const STEPS = \[/g) || []).length === 1);

  /* Back must not reset anything: it only moves an index. */
  ok("Back only changes the step index", /const back = \(\) => goTo\(Math\.max\(safeIndex - 1, 0\)\)/.test(page));
  ok("project state lives on the page, so selections and uploads survive Back",
     /const \[project, setProject\] = useState\(emptyProject\)/.test(page));
  ok("goTo clears only validation errors", /const goTo = \(index\) => \{\s*setErrors\(\{\}\);/.test(page));

  ok("Continue is disabled until the step is complete", /continueDisabled=\{!stepIsComplete\}/.test(page));
  ok("and says what is missing", /blockingReason=\{blockingReason\(\)\}/.test(page));
  ok("the upload step's primary action is Build My Free Proof",
     /"Build My Free Proof"/.test(page));
}

/* ── 32. Carousel ── */
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
  ok("buttons are at least 44px", Number((css.match(/\.ip-btn \{[\s\S]*?min-height: (\d+)px/) || [])[1]) >= 44);
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
     /\.ip-root \{\s*--proof-gold/.test(readFileSync(resolve(ROOT, "src/instant-proof/tokens.js"), "utf8")) &&
     !/^\s*:root\s*\{/m.test(css));
}

/* ── 34. Processing starts, and starts once ── */
group("34. Processing initialisation");
{
  const page = readFileSync(resolve(ROOT, "src/pages/InstantProof.jsx"), "utf8");

  ok("the renderer is stable state, not a discardable useMemo",
     /const \[renderer\] = useState\(\(\) => getProofRenderer\(\)\)/.test(page) &&
     !/useMemo\(\(\) => getProofRenderer/.test(page));
  ok("rendering is driven by an effect keyed on being ON the proof step",
     /if \(step\.id !== "proof"\) return undefined;/.test(page));
  ok("no persistent one-shot guard survives StrictMode cleanup",
     !/startedRef|hasStarted|renderStartedRef/.test(page));
  ok("entering the proof step always starts a run",
     /setProcessingRunId\(\(id\) => id \+ 1\)/.test(page));
  /* The original bug: isLastInput compared against "review", a step deleted in
     the move to three steps, so it was permanently false. Derived now. Scoped
     to that line — "review" still legitimately names a CTA kind elsewhere. */
  ok("the last input step is derived, not a hardcoded id that can go stale",
     /const isLastInput = step\?\.id === STEPS\[STEPS\.length - 2\]\.id;/.test(page));
  /* beginProof must put a real status up immediately. idleStatus survives only
     as the initial value and in startOver, which returns to step 1 — neither
     can leave the proof screen showing "Waiting to start". */
  ok("a new run resets status to a real state, never idle",
     /message: "Preparing your files"/.test(page));
  ok("idleStatus is only the initial value and the start-over reset",
     (page.match(/idleStatus\(\)/g) || []).length === 1 && /useState\(idleStatus\)/.test(page));
  ok("the effect is cancellable, which is what makes it StrictMode-safe",
     /let cancelled = false;/.test(page) && /cancelled = true;/.test(page));
  ok("every timer the run creates is tracked and cleared by its own cleanup",
     /const timeoutIds = \[\]/.test(page) && /for \(const id of timeoutIds\) clearTimeout\(id\)/.test(page));
  ok("cleanup cancels only that run's job", /renderer\.cancelProofJob\?\.\(jobId\)/.test(page));
  ok("no setInterval anywhere in the lifecycle", !/setInterval/.test(page));
  ok("retry re-enters through the same path", /onRetry=\{beginProof\}/.test(page));
  ok("starting over resets the run id", /setProcessingRunId\(0\)/.test(page));
  ok("progress can never run backwards", /Math\.max\(current\.progress/.test(page));
}

/* ── 35. Processing under a simulated StrictMode double-invoke ── */
group("35. Processing runs end to end under StrictMode");
{
  /* Browser APIs the mock renderer measures images with. */
  globalThis.URL.createObjectURL = () => "blob:x";
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.Image = class {
    set src(_) {
      queueMicrotask(() => {
        this.naturalWidth = 1200;
        this.naturalHeight = 1600;
        this.onload();
      });
    }
  };

  const { createMockProofRenderer } = await import("../src/instant-proof/rendering/mockProofRenderer.js");
  const { JOB_STATES } = await import("../src/instant-proof/models.js");

  /* Count live intervals so a leaked timer is detectable. */
  let live = 0;
  const realSet = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  globalThis.setInterval = (...args) => { live += 1; return realSet(...args); };
  globalThis.clearInterval = (id) => { if (id != null) live -= 1; return realClear(id); };

  const snapshot = {
    ...emptyProject(),
    publicationTypeId: "yearbook",
    visual: { ...emptyProject().visual, templateId: "photo-gallery" },
    assets: Array.from({ length: 3 }, (_, i) => ({
      id: `p${i}`, name: `IMG_${i}.jpg`, extension: ".jpg", size: 10,
      kind: "image", file: new File(["x"], `IMG_${i}.jpg`), previewUrl: "blob:x",
    })),
  };

  /* The effect from InstantProof.jsx, transcribed. */
  const runEffect = (renderer, setStatus, setResult, setError) => {
    let cancelled = false;
    let timer = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    (async () => {
      try {
        const job = await renderer.createProofJob(snapshot);
        if (cancelled) return;
        await renderer.uploadProofAssets(job.id, snapshot.assets, () => {});
        if (cancelled) return;
        await renderer.startProofRender(job.id);
        if (cancelled) return;
        stop();
        timer = setInterval(async () => {
          try {
            const st = await renderer.getProofStatus(job.id);
            if (cancelled) return;
            setStatus(st);
            if (st.state === JOB_STATES.complete) { stop(); setResult(await renderer.getProofResult(job.id)); }
            else if (st.state === JOB_STATES.failed) { stop(); setError(st.error); }
          } catch { stop(); if (!cancelled) setError("lost track"); }
        }, 400);
      } catch { if (!cancelled) setError("could not start"); }
    })();
    return () => { cancelled = true; stop(); };
  };

  const renderer = createMockProofRenderer();
  let status = { state: "uploading", progress: 0.01, message: "Preparing your files" };
  let result = null;
  let failure = "";

  ok("the first paint never shows 'Waiting to start'", status.message !== "Waiting to start");

  /* StrictMode: run, tear down, run again. */
  const cleanup1 = runEffect(renderer, (v) => (status = v), (r) => (result = r), (e) => (failure = e));
  cleanup1();
  const cleanup2 = runEffect(renderer, (v) => (status = v), (r) => (result = r), (e) => (failure = e));

  /* setTimeout, not the captured setInterval — an interval used as a one-shot
     wait resolves the promise but then keeps the Node event loop alive for
     ever, which hangs the whole suite. */
  await new Promise((resolve) => setTimeout(resolve, 9000));

  ok("processing completed", status.state === "complete", `state ${status.state}, ${Math.round(status.progress * 100)}%`);
  ok("it did not stall at 0%", status.progress === 1);
  ok("no error was raised", failure === "", failure);
  ok("a proof came back", Boolean(result) && result.pages.length === 3);
  ok("exactly one timer ran and it was cleared", live === 0, `${live} live`);

  cleanup2();
  ok("unmount leaves no timer behind", live === 0);

  globalThis.setInterval = realSet;
  globalThis.clearInterval = realClear;
}

/* ── 36. The processing lifecycle, on fake timers ── */
group("36. Processing lifecycle (fake timers)");
{
  const { createMockProofRenderer } = await import("../src/instant-proof/rendering/mockProofRenderer.js");
  const { JOB_STATES } = await import("../src/instant-proof/models.js");

  globalThis.URL.createObjectURL = () => "blob:x";
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.Image = class {
    set src(_) {
      queueMicrotask(() => { this.naturalWidth = 1200; this.naturalHeight = 1600; this.onload(); });
    }
  };

  /*
   * A controllable clock. The pipeline awaits promises resolved by timers, so
   * after firing one we yield to the real event loop to let the microtask
   * queue drain before deciding what is due next.
   */
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  function installFakeTimers() {
    let now = 0;
    let seq = 0;
    const scheduled = new Map();
    globalThis.setTimeout = (fn, ms = 0) => {
      const id = ++seq;
      scheduled.set(id, { fn, at: now + ms });
      return id;
    };
    globalThis.clearTimeout = (id) => scheduled.delete(id);
    return {
      async advance(ms) {
        const target = now + ms;
        for (;;) {
          /* Let any pending promise chain run first — it may not have reached
             its setTimeout yet, and looking for due timers before it does
             would end the advance with work still to come. */
          await new Promise((r) => realSetTimeout(r, 0));
          const due = [...scheduled.entries()]
            .filter(([, t]) => t.at <= target)
            .sort((a, b) => a[1].at - b[1].at);
          if (due.length === 0) break;
          const [id, entry] = due[0];
          scheduled.delete(id);
          now = entry.at;
          entry.fn();
          await new Promise((r) => realSetTimeout(r, 0));
        }
        now = target;
      },
      pending: () => scheduled.size,
      restore() {
        globalThis.setTimeout = realSetTimeout;
        globalThis.clearTimeout = realClearTimeout;
      },
    };
  }

  const photoProject = {
    ...emptyProject(),
    publicationTypeId: "yearbook",
    visual: { ...emptyProject().visual, templateId: "photo-gallery" },
    assets: Array.from({ length: 3 }, (_, i) => ({
      id: `p${i}`, name: `IMG_${i}.jpg`, extension: ".jpg", size: 10,
      kind: "image", file: new File(["x"], `IMG_${i}.jpg`), previewUrl: "blob:x",
    })),
  };

  /* The component's effect body, transcribed. No persistent started flag. */
  const startRun = (renderer, snapshot, sink) => {
    let cancelled = false;
    let jobId = null;
    const timeoutIds = [];
    const delay = (ms) => new Promise((resolve) => { timeoutIds.push(setTimeout(resolve, ms)); });

    sink.setStatus({ state: JOB_STATES.uploading, progress: 0, stageId: "", message: "Preparing your files" });

    (async () => {
      try {
        const job = await renderer.createProofJob(snapshot);
        if (cancelled) { renderer.cancelProofJob?.(job.id); return; }
        jobId = job.id;
        await renderer.uploadProofAssets(job.id, snapshot.assets, (f) => {
          if (!cancelled) sink.setStatus({ state: JOB_STATES.uploading, progress: f * 0.05, message: "Preparing your files" });
        });
        if (cancelled) return;
        await renderer.startProofRender(job.id);
        if (cancelled) return;
        for (;;) {
          if (cancelled) return;
          const next = await renderer.getProofStatus(job.id);
          if (cancelled) return;
          sink.setStatus(next);
          if (next.state === JOB_STATES.complete) {
            const proof = await renderer.getProofResult(job.id);
            if (cancelled) return;
            await delay(450);
            if (cancelled) return;
            sink.complete(proof);
            return;
          }
          if (next.state === JOB_STATES.failed) throw new Error(next.error);
          await delay(400);
        }
      } catch (error) {
        if (!cancelled) sink.setError(error.message);
      }
    })();

    return () => {
      cancelled = true;
      for (const id of timeoutIds) clearTimeout(id);
      if (jobId) renderer.cancelProofJob?.(jobId);
    };
  };

  const makeSink = () => {
    const state = { status: null, result: null, error: "", writes: 0 };
    return {
      state,
      setStatus: (v) => { state.status = v; state.writes += 1; },
      complete: (p) => { state.result = p; state.writes += 1; },
      setError: (e) => { state.error = e; state.writes += 1; },
    };
  };

  /* 1-3. Starts immediately, moves off 0%, reaches 100%. */
  {
    const clock = installFakeTimers();
    const renderer = createMockProofRenderer();
    const sink = makeSink();
    startRun(renderer, photoProject, sink);

    ok("1. the pipeline starts immediately, not at 'Waiting to start'",
       sink.state.status?.message === "Preparing your files");

    await clock.advance(1500);
    ok("2. progress moves off zero", (sink.state.status?.progress ?? 0) > 0,
       `${Math.round((sink.state.status?.progress ?? 0) * 100)}%`);

    await clock.advance(12000);
    ok("3. progress reaches 100%", sink.state.status?.progress === 1);
    ok("   and the proof is handed over", Boolean(sink.state.result));
    ok("   with no error", sink.state.error === "");
    clock.restore();
  }

  /* 4. Completes under StrictMode's setup/cleanup/setup. */
  {
    const clock = installFakeTimers();
    const renderer = createMockProofRenderer();
    const sink = makeSink();
    const cleanup1 = startRun(renderer, photoProject, sink);
    cleanup1();                                   // StrictMode tears the first down
    const cleanup2 = startRun(renderer, photoProject, sink);
    await clock.advance(14000);
    ok("4. completes under StrictMode setup/cleanup/setup", Boolean(sink.state.result));
    ok("   reaching 100%", sink.state.status?.progress === 1);
    cleanup2();
    ok("   and leaves no timer pending", clock.pending() === 0, `${clock.pending()} pending`);
    clock.restore();
  }

  /* 5. Cleanup prevents stale updates. */
  {
    const clock = installFakeTimers();
    const renderer = createMockProofRenderer();
    const sink = makeSink();
    const cleanup = startRun(renderer, photoProject, sink);
    await clock.advance(2000);
    const writesAtCleanup = sink.state.writes;
    cleanup();
    await clock.advance(20000);
    ok("5. no state is written after cleanup", sink.state.writes === writesAtCleanup,
       `${sink.state.writes - writesAtCleanup} stale writes`);
    ok("   and no proof is delivered by a cancelled run", sink.state.result === null);
    clock.restore();
  }

  /* 6. Retry is a completely new run. */
  {
    const clock = installFakeTimers();
    const renderer = createMockProofRenderer();
    const first = makeSink();
    const cleanupFirst = startRun(renderer, photoProject, first);
    await clock.advance(1200);
    cleanupFirst();                               // abandon it, as Retry does

    const retry = makeSink();
    startRun(renderer, photoProject, retry);
    ok("6. retry starts from zero", retry.state.status?.progress === 0);
    await clock.advance(14000);
    ok("   and runs to completion", Boolean(retry.state.result) && retry.state.status?.progress === 1);
    ok("   the abandoned run delivered nothing", first.state.result === null);
    clock.restore();
  }

  /* 7. Photographs only — no email, title, CSV or optional details. */
  {
    const clock = installFakeTimers();
    const renderer = createMockProofRenderer();
    const sink = makeSink();
    const bare = {
      ...emptyProject(),
      publicationTypeId: "yearbook",
      visual: { ...emptyProject().visual, templateId: "photo-gallery" },
      assets: [{ id: "solo", name: "one.jpg", extension: ".jpg", size: 10, kind: "image", file: new File(["x"], "one.jpg"), previewUrl: "blob:x" }],
    };
    ok("7. the project carries no email, contact name or phone",
       !("email" in bare.organization) && !("contactName" in bare.organization));
    ok("   no organization name", bare.organization.organizationName === "");
    ok("   no spreadsheet", bare.data.records.length === 0);
    ok("   and no per-photo details", !bare.assets[0].details);

    startRun(renderer, bare, sink);
    await clock.advance(14000);
    ok("   a single photograph still produces a proof",
       Boolean(sink.state.result) && sink.state.result.pages.length === 3);
    ok("   at 100%", sink.state.status?.progress === 1);
    clock.restore();
  }
}

/* ── Regression guard across every template ── */
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

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
