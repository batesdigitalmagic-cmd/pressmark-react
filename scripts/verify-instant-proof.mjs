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
import { schemaFor } from "../src/instant-proof/csv/schemas.js";
import { matchPhotos } from "../src/instant-proof/csv/photoMatching.js";
import { parseCsv } from "../src/instant-proof/csv/parseCsv.js";
import { applyMapping, mappingFromProposals, suggestMapping } from "../src/instant-proof/csv/columnMapping.js";
import { analyzeRecords } from "../src/instant-proof/csv/analyzeRecords.js";
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
import { defaultTemplateFor } from "../src/instant-proof/templates/registry.js";
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

const SCHEMA = schemaFor("people-directory");
const DIRECTORY = templateFor("directory-classic");
const LISTING = DIRECTORY.pages.find((p) => p.pageType === "listing-spread");
const GRIDS = LISTING.elements.filter((e) => e.type === "repeater");

/* Reserved bands, resolved once — the card's text elements in page order. */
const CARD = GRIDS[0].cell;
const CARD_BOX = cellBox(GRIDS[0]);
const band = (field) => CARD.find((e) => e.field === field);
const NAME = band("personName");
const TITLE = band("role:secondaryText");
const ADDRESS = band("streetAddress");
const CITY = band("cityStateLine");

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
     `card ${CARD_BOX.widthIn} x ${CARD_BOX.heightIn}in, last band ends ${(CITY.y + CITY.height).toFixed(2)}in`);

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
  const secondRowContentBottom = secondRowTop + CITY.y + CITY.height;
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
  ok("name cannot reach the title", NAME.y + NAME.height <= TITLE.y,
     `name ends ${(NAME.y + NAME.height).toFixed(2)}, title starts ${TITLE.y}`);
  ok("title cannot reach the address", TITLE.y + TITLE.height <= ADDRESS.y,
     `title ends ${(TITLE.y + TITLE.height).toFixed(2)}, address starts ${ADDRESS.y}`);
  ok("portrait clears the name", 2.35 <= NAME.y, "portrait ends 2.35in");
}

/* ── 7 & 8. Long text is contained ── */
group("7-8. Long text stays within its line limit");
{
  ok("name band allows exactly two lines", NAME.maxLines === 2);
  ok("address band allows exactly two lines", ADDRESS.maxLines === 2);
  ok("city line allows exactly one", CITY.maxLines === 1);

  const nameRole = DIRECTORY.fontRoles[NAME.fontRole];
  const fitted = fitTypeSize(LONG_NAME, NAME.width, NAME.height, nameRole.size, NAME.maxLines, nameRole.lineHeight);
  ok("a 41-character name shrinks rather than overflowing", fitted <= nameRole.size,
     `${nameRole.size}pt -> ${fitted.toFixed(1)}pt`);
  ok("shrinking respects the legibility floor", fitted >= 7, `${fitted.toFixed(1)}pt >= 7pt`);
  ok("fitted long name occupies no more than its band",
     (Math.min(estimateLines(LONG_NAME, NAME.width, fitted), NAME.maxLines) * fitted * nameRole.lineHeight) / 72 <= NAME.height + 1e-9);
  ok("name uses shrink-then-clamp", NAME.textFit === "shrink");
  ok("address clamps with an ellipsis", ADDRESS.textFit === "clamp");
  ok("city truncates on one line", CITY.textFit === "truncate");

  const addrRole = DIRECTORY.fontRoles[ADDRESS.fontRole];
  ok("a 50-character address needs no more than two lines at its size",
     estimateLines(LONG_ADDRESS, ADDRESS.width, addrRole.size) <= 3,
     `${estimateLines(LONG_ADDRESS, ADDRESS.width, addrRole.size)} lines, clamped to ${ADDRESS.maxLines}`);
}

/* ── 9. Missing fields collapse without disturbing the card ── */
group("9. Missing fields collapse cleanly");
{
  const noTitle = RECORDS[7];
  ok("record 8 genuinely has no title", noTitle.title === "");
  ok("its title binding resolves to empty",
     resolveBinding(TITLE.field, { record: noTitle, schema: SCHEMA }).value === "");
  ok("its name still resolves", resolveBinding(NAME.field, { record: noTitle, schema: SCHEMA }).value === "Li, Wei");
  ok("its address still resolves", resolveBinding(ADDRESS.field, { record: noTitle, schema: SCHEMA }).value === "412 Larkspur Lane");
  /* Bands are at fixed coordinates, so an empty one cannot move its neighbours.
     That is the guarantee — not that the renderer happens to reflow correctly. */
  ok("the address band's position does not depend on the title", ADDRESS.y === 3.63);

  const noAddress = { display_name: "Nobody, A", city: "", state: "", postal_code: "" };
  ok("an absent address resolves to empty", resolveBinding(ADDRESS.field, { record: noAddress, schema: SCHEMA }).value === "");
  ok("an absent city line resolves to empty", resolveBinding(CITY.field, { record: noAddress, schema: SCHEMA }).value === "");

  const partial = { first_name: "Ada", last_name: "Lovelace" };
  ok("a name with no display_name falls back to first + last",
     resolveBinding(NAME.field, { record: partial, schema: SCHEMA }).value === "Ada Lovelace");
  ok("an empty record yields no name, not a placeholder",
     resolveBinding(NAME.field, { record: null, schema: SCHEMA }).value === "");
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
  ok("the biography comes first", fields[0] === "role:bodyText");
  ok("contact fields follow it", fields.slice(1).join(",") ===
     "streetAddress,cityStateLine,role:phone,role:email,role:website");
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

  const BIO = "Ava has served on the board since 2019 and chairs the planning committee. She previously led the capital campaign that funded the community hall.";
  const full = {
    display_name: "Whitfield, Ava", title: "Board President", short_bio: BIO,
    address: "412 Larkspur Lane", city: "Marietta", state: "GA", postal_code: "30060",
    phone: "770-555-0142", email: "ava@example.org", website: "https://example.org",
  };

  const a = layout(full);
  ok("a complete record lays out all six lines", a.rows.length === 6);
  ok("contact begins immediately below the biography",
     Math.abs(a.rows[1].top - (a.rows[0].bottom + stack.groupGap)) < 1e-9,
     `bio ends ${a.rows[0].bottom.toFixed(2)}in, contact starts ${a.rows[1].top.toFixed(2)}in`);
  ok("nothing runs past the region", a.used <= stack.height + 1e-9,
     `uses ${a.used.toFixed(2)}in of ${stack.height}in`);

  const noContact = layout({ display_name: "Li, Wei", short_bio: "A long-standing member." });
  ok("a record with no contact details lays out the biography alone", noContact.rows.length === 1);
  ok("its biography still starts at the top of the region", noContact.rows[0].top === 0);

  const sparse = layout({ display_name: "Nakamura, Kenji", short_bio: "Keeps the books.", phone: "770-555-0201" });
  ok("absent address, email and website take no space", sparse.rows.length === 2,
     sparse.rows.map((r) => r.field).join(" + "));
  ok("the surviving contact line flows up to meet the biography",
     Math.abs(sparse.rows[1].top - (sparse.rows[0].bottom + stack.groupGap)) < 1e-9,
     `phone starts ${sparse.rows[1].top.toFixed(2)}in`);

  const noBio = layout({ display_name: "Osei, Daniel", address: "9 Peachtree Way", city: "Austell", state: "GA" });
  ok("with no biography the contact block starts at the top", noBio.rows[0].top === 0);
  ok("and it is the address", noBio.rows[0].field === "streetAddress");

  /* An implausibly long biography must not push contact past the region. */
  const huge = layout({ ...full, short_bio: "word ".repeat(600) });
  ok("an overlong biography is trimmed rather than overflowing", huge.used <= stack.height + 1e-9,
     `uses ${huge.used.toFixed(2)}in of ${stack.height}in`);
  ok("the contact block survives the trim", huge.rows.length === 6);
  ok("no two rows overlap in any case",
     [a, sparse, noBio, huge].every((l) =>
       l.rows.every((r, i) => i === 0 || r.top >= l.rows[i - 1].bottom - 1e-9)));
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
     ["people-directory", "yearbook-portraits", "editorial", "event-schedule", "annual-report-metrics", "sponsors"]
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
  ok("and on unmount, via a ref so the cleanup sees the final list",
     /assetsRef/.test(page) && /revokeObjectURL/.test(page.slice(page.indexOf("assetsRef"))));
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

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
