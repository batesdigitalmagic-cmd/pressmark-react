/*
 * The proof preview.
 *
 * As of Phase 2 this is composition only: the pages themselves come from
 * TemplateRenderer driving a design-template manifest, with the customer's real
 * records, photographs, colors and logo bound into it.
 *
 * What remains here is the book presentation — trim proportions, a spine
 * shadow between facing pages, a drop shadow beneath — because Pressmark sells
 * printed publications and a browser frame communicates the wrong thing.
 *
 * The Pressmark footer credit lives inside TemplateRenderer so it survives the
 * Phase 3 swap of page contents for InDesign rasters.
 */

import TemplateRenderer from "../render/TemplateRenderer.jsx";
import { resolveColors } from "../render/colors.js";
import { schemaFor } from "../csv/schemas.js";
import { captionFor, templateFor } from "../templates/registry.js";
import { planProof } from "../render/proofPlan.js";
import { matchPhotos } from "../csv/photoMatching.js";
import { ASSET_KINDS } from "../models.js";
import { recordsFor } from "../photoProject.js";
import { PALETTE } from "../styles.js";

/* Shown when no CSV was supplied, so the design and the customer's colors are
   still demonstrable. Obviously fictional — nobody should mistake these for
   their own data. */
const PLACEHOLDER_RECORDS = [
  { record_id: "1", display_name: "Sample Record One", title: "Position or Grade", group_name: "Section Name", category: "Section Name" },
  { record_id: "2", display_name: "Sample Record Two", title: "Position or Grade", group_name: "Section Name" },
  { record_id: "3", display_name: "Sample Record Three", title: "Position or Grade", group_name: "Section Name" },
  { record_id: "4", display_name: "Sample Record Four", title: "Position or Grade", group_name: "Section Name" },
  { record_id: "5", display_name: "Sample Record Five", title: "Position or Grade", group_name: "Section Name" },
  { record_id: "6", display_name: "Sample Record Six", title: "Position or Grade", group_name: "Section Name" },
];

const placeholderSet = (count) =>
  Array.from({ length: count }, (_, index) => ({
    ...PLACEHOLDER_RECORDS[index % PLACEHOLDER_RECORDS.length],
    record_id: String(index + 1),
  }));

/** One page or spread, presented as printed matter. */
function BookPage({ label, caption, children, single }) {
  return (
    <figure style={{ margin: 0, display: "grid", gap: "0.9rem" }}>
      <div
        className="ip-book"
        style={{
          position: "relative",
          width: single ? "min(100%, 360px)" : "100%",
          margin: single ? "0 auto" : undefined,
          background: "#ffffff",
        }}
      >
        {children}
        {!single && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: "50%",
              width: 22,
              transform: "translateX(-50%)",
              background:
                "linear-gradient(90deg, rgba(2,8,20,0) 0%, rgba(2,8,20,0.16) 44%, rgba(2,8,20,0.28) 50%, rgba(2,8,20,0.16) 56%, rgba(2,8,20,0) 100%)",
              pointerEvents: "none",
              zIndex: 6,
            }}
          />
        )}
      </div>
      <figcaption style={{ display: "grid", gap: "0.2rem" }}>
        <span
          style={{
            fontSize: "0.66rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: PALETTE.accent,
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: "0.85rem", lineHeight: 1.6, color: PALETTE.textMuted }}>{caption}</span>
      </figcaption>
    </figure>
  );
}

export default function PublicationMockup({ project, config, result }) {
  const template = templateFor(project.visual.templateId);

  /* A project that somehow reaches the results view with no template still has
     to render something rather than crashing the page. */
  if (!template) {
    return (
      <p style={{ color: PALETTE.textMuted, fontSize: "0.9rem" }}>
        No design template was selected, so there is nothing to preview.
      </p>
    );
  }

  const schema = schemaFor(project.data?.schemaId) ?? schemaFor(template.schemas[0]);
  const colors = resolveColors(template, project.visual);
  const images = project.assets.filter((asset) => asset.kind === ASSET_KINDS.image);

  const realRecords = recordsFor(project);
  const usingRealData = realRecords.length > 0;

  const records = usingRealData ? realRecords : placeholderSet(40);
  const plan = planProof(template, records);

  /*
   * Build the row → asset index once rather than per cell. With real data this
   * is the same matching the production report quotes; with placeholders it
   * hands out the uploaded photographs in order so the design still shows the
   * customer's own images.
   */
  const matching =
    usingRealData && schema?.imageField
      ? matchPhotos(realRecords, schema.imageField, images, project.data?.photoOverrides ?? {})
      : null;

  const assetByRecordId = new Map();
  if (matching) {
    for (const match of matching.matches) {
      if (match.asset) assetByRecordId.set(match.record, match.asset);
    }
  }

  let fallbackCursor = 0;
  const fallbackByRecord = new Map();
  if (!matching && images.length > 0) {
    for (const record of records) {
      fallbackByRecord.set(record, images[fallbackCursor % images.length]);
      fallbackCursor += 1;
    }
  }

  const context = {
    schema,
    organization: project.organization,
    logo: project.visual.logo,
    publicationLabel: config?.label ?? "Publication",
    assetForRecord: (record) =>
      record ? assetByRecordId.get(record) ?? fallbackByRecord.get(record) ?? null : null,
  };

  return (
    <div style={{ display: "grid", gap: "2.5rem" }}>
      {plan.pages.map(({ page, records: pageRecords }) => (
        <BookPage
          key={page.id}
          label={page.label}
          caption={captionFor(page, pageRecords.length)}
          single={page.form === "single"}
        >
          <TemplateRenderer
            template={template}
            page={page}
            records={pageRecords}
            context={context}
            colors={colors}
          />
        </BookPage>
      ))}

      {result?.manualMode && (
        <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: PALETTE.textMuted, margin: 0 }}>
          These pages use placeholder records because no spreadsheet was supplied. The design, your
          colors and your logo are real — upload a CSV to see your own names and details in this
          layout.
        </p>
      )}
    </div>
  );
}
