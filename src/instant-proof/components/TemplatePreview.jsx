/*
 * "Preview Design" — a dialog showing a template's pages before the customer
 * commits to it.
 *
 * Renders through the same TemplateRenderer the final proof uses, with sample
 * records rather than the customer's data, so what they preview is genuinely
 * what they will get. The customer's own brand colors are already applied here,
 * which makes the choice concrete rather than abstract.
 *
 * Implemented as a native <dialog>: it gets focus trapping, Escape-to-close and
 * inert background content from the platform rather than from hand-rolled
 * keyboard handling that would inevitably be worse.
 */

import { useEffect, useRef } from "react";
import TemplateRenderer from "../render/TemplateRenderer.jsx";
import { resolveColors } from "../render/colors.js";
import { planProof } from "../render/proofPlan.js";
import { schemaFor } from "../csv/schemas.js";
import { PALETTE, FONT_STACK, IP } from "../styles.js";

/*
 * Obviously-fictional records so nobody mistakes a preview for their own data.
 * Covers the fields both shipped templates bind to.
 */
const SAMPLE_RECORDS = [
  { record_id: "1", display_name: "Whitfield, Ava", title: "Board President", grade: "12", group_name: "Board of Directors", category: "Board of Directors", city: "Marietta", state: "GA", phone: "770-555-0142", email: "ava@example.org", short_bio: "Ava has served on the board since 2019 and chairs the planning committee.", quote: "Leave it better than you found it." },
  { record_id: "2", display_name: "Okonkwo, Benjamin", title: "Vice President", grade: "11", group_name: "Board of Directors", city: "Marietta", state: "GA", phone: "770-555-0187", email: "ben@example.org" },
  { record_id: "3", display_name: "Reyes-Alvarado, Marisol", title: "Membership Secretary", grade: "12", group_name: "Committee Chairs", city: "Kennesaw", state: "GA", phone: "770-555-0263" },
  { record_id: "4", display_name: "Nakamura, Kenji", title: "Treasurer", grade: "10", group_name: "Committee Chairs", city: "Smyrna", state: "GA" },
  { record_id: "5", display_name: "Abernathy-Cole, Charlotte", title: "Communications Chair", grade: "11", group_name: "Committee Chairs", city: "Marietta", state: "GA" },
  { record_id: "6", display_name: "Osei, Daniel", title: "Member at Large", grade: "12", group_name: "Membership", city: "Austell", state: "GA" },
];

/* Enough repeats to fill the largest grid either template declares. */
const sampleFor = (count) =>
  Array.from({ length: count }, (_, index) => ({
    ...SAMPLE_RECORDS[index % SAMPLE_RECORDS.length],
    record_id: String(index + 1),
  }));

export default function TemplatePreview({ template, visual, organization, publicationLabel, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();
    const onCancel = () => onClose();
    dialog.addEventListener("close", onCancel);
    return () => dialog.removeEventListener("close", onCancel);
  }, [onClose]);

  if (!template) return null;

  const colors = resolveColors(template, visual);
  const plan = planProof(template, sampleFor(40));
  const schema = schemaFor(template.schemas[0]);

  const context = {
    schema,
    organization: {
      ...organization,
      organizationName: organization?.organizationName || "Your Organization",
    },
    logo: visual?.logo ?? null,
    publicationLabel,
    /* Previews use the template's own placeholder art for portraits — the
       customer has not uploaded anything at this point in the flow. */
    assetForRecord: () => null,
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="template-preview-title"
      style={{
        width: "min(1000px, 94vw)",
        maxHeight: "92vh",
        padding: 0,
        border: `1px solid ${PALETTE.hairline}`,
        borderRadius: 4,
        background: PALETTE.white,
        color: PALETTE.text,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "1.25rem 1.5rem",
            borderBottom: `1px solid ${PALETTE.hairline}`,
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id="template-preview-title"
              style={{ fontFamily: FONT_STACK, fontSize: "1.5rem", fontWeight: 900, margin: "0 0 0.25rem" }}
            >
              {template.name}
            </h2>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.55, color: PALETTE.textMuted, margin: 0, maxWidth: 560 }}>
              {template.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: 2,
              border: `1px solid ${PALETTE.hairline}`,
              background: "transparent",
              color: PALETTE.text,
              fontSize: "1.1rem",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </header>

        <div style={{ padding: "1.5rem", overflowY: "auto", display: "grid", gap: "1.75rem", background: PALETTE.paper }}>
          <p style={{ ...IP.notice, margin: 0 }}>
            Shown with placeholder people and your chosen colors. Your own records and photographs
            are placed into this design at the end of the flow.
          </p>

          {plan.pages.map(({ page, records }) => (
            <figure key={page.id} style={{ margin: 0, display: "grid", gap: "0.6rem" }}>
              <div className="ip-book" style={{ width: page.form === "single" ? "min(100%, 360px)" : "100%", margin: page.form === "single" ? "0 auto" : undefined }}>
                <TemplateRenderer
                  template={template}
                  page={page}
                  records={records}
                  context={context}
                  colors={colors}
                />
              </div>
              <figcaption style={{ fontSize: "0.75rem", color: PALETTE.textMuted, textAlign: "center" }}>
                <strong style={{ color: PALETTE.text }}>{page.label}</strong> — {page.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </dialog>
  );
}
