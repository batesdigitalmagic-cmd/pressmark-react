/*
 * Step 5 — review and consent.
 *
 * The last thing between a visitor and handing over other people's
 * photographs, so it states plainly what was collected, what will happen to it
 * and what they are agreeing to. The consent checkbox is a hard gate — the
 * parent will not create a job without it.
 */

import { formatBytes } from "../models.js";
import { templateFor } from "../templates/registry.js";
import { schemaFor } from "../csv/schemas.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

function Row({ label, children }) {
  return (
    <div style={{ display: "grid", gap: "0.2rem" }}>
      <dt
        style={{
          fontSize: "0.66rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: PALETTE.accent,
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.6, color: PALETTE.text }}>
        {children || <span style={{ color: PALETTE.textMuted }}>Not provided</span>}
      </dd>
    </div>
  );
}

export default function SubmissionReview({ project, config, onEditStep, onConsentChange, consentError }) {
  const template = templateFor(project.visual.templateId);
  const schema = schemaFor(project.data?.schemaId);
  const recordCount = project.data?.records?.length ?? 0;
  const { organization: org, assets } = project;
  const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);

  /* Steps are addressed by ID, not position — the data step appears and
     disappears with the spreadsheet, so positions are not stable. */
  const editButton = (stepId, label) => (
    <button
      type="button"
      onClick={() => onEditStep(stepId)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: PALETTE.accent,
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 3,
      }}
    >
      Edit<span className="ip-sr-only"> {label}</span>
    </button>
  );

  const card = (title, stepId, srLabel, children) => (
    <section style={{ ...IP.card, display: "grid", gap: "1rem", alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
        <h3 style={{ fontFamily: FONT_STACK, fontSize: "1.3rem", fontWeight: 800, margin: 0, color: PALETTE.text }}>
          {title}
        </h3>
        {editButton(stepId, srLabel)}
      </div>
      {children}
    </section>
  );

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <div className="ip-review-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
        {card("Publication", "type", "publication type", (
          <dl style={{ display: "grid", gap: "0.9rem", margin: 0 }}>
            <Row label="Type">{config?.label}</Row>
            <Row label="What it is">{config?.description}</Row>
          </dl>
        ))}

        {card("Organization", "details", "organization details", (
          <dl style={{ display: "grid", gap: "0.9rem", margin: 0 }}>
            <Row label="Organization">{org.organizationName}</Row>
            <Row label="Location">{org.cityState}</Row>
            <Row label="Size and length">
              {org.publicationSize}
              <br />
              {org.estimatedPageCount} · {org.deadline}
            </Row>
          </dl>
        ))}

        {card("Design", "visual", "visual direction", (
          <dl style={{ display: "grid", gap: "0.9rem", margin: 0 }}>
            <Row label="Template">{template?.name}</Row>
            <Row label="Colors">
              <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                {[project.visual.primaryColor, project.visual.secondaryColor].map((color, index) => (
                  <span key={`${color}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 2,
                        background: color,
                        border: "1px solid rgba(2,8,20,0.12)",
                      }}
                    />
                    <span style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: "0.8rem" }}>
                      {color}
                    </span>
                  </span>
                ))}
              </span>
            </Row>
            <Row label="Logo">{project.visual.logo?.name}</Row>
            <Row label="Notes">{project.visual.designNotes}</Row>
          </dl>
        ))}

        {card("Content", "content", "uploaded files", (
          <>
            <p style={{ fontSize: "0.85rem", color: PALETTE.textMuted, margin: 0 }}>
              {assets.length} file{assets.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
              {recordCount > 0 && (
                <>
                  {" · "}
                  <strong style={{ color: PALETTE.text }}>{recordCount} records</strong>
                  {schema ? ` (${schema.label})` : ""}
                </>
              )}
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.35rem", maxHeight: 220, overflowY: "auto" }}>
              {assets.map((asset) => (
                <li
                  key={asset.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    fontSize: "0.82rem",
                    color: PALETTE.text,
                    paddingBottom: "0.35rem",
                    borderBottom: `1px solid ${PALETTE.hairline}`,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</span>
                  <span style={{ flexShrink: 0, color: PALETTE.textMuted }}>{formatBytes(asset.size)}</span>
                </li>
              ))}
            </ul>
          </>
        ))}
      </div>

      <section style={{ ...IP.card, background: PALETTE.paper, display: "grid", gap: "1rem" }}>
        <h3 style={{ fontFamily: FONT_STACK, fontSize: "1.3rem", fontWeight: 800, margin: 0, color: PALETTE.text }}>
          What you will receive
        </h3>
        <p style={{ fontSize: "0.92rem", lineHeight: 1.7, color: PALETTE.textMuted, margin: 0 }}>
          {template
            ? `${template.pages.length} sample pages from ${template.name} — ${template.pages
                .map((page) => page.label.replace(/^Interior spread — /, ""))
                .join(", ")} — set in your colors`
            : config?.sampleOutput}
          {recordCount > 0
            ? `, with your own records and photographs placed into the design.`
            : `. No spreadsheet was supplied, so the sample uses placeholder records and is labelled accordingly.`}
        </p>
      </section>

      <section aria-labelledby="privacy-heading" style={{ ...IP.card, display: "grid", gap: "1rem" }}>
        <h3 id="privacy-heading" style={{ fontFamily: FONT_STACK, fontSize: "1.3rem", fontWeight: 800, margin: 0, color: PALETTE.text }}>
          Privacy
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: PALETTE.textMuted, margin: 0 }}>
          Your sample is private and automatically removed after 48 hours. In this
          prototype your files never leave your browser — they are held in this tab's memory only,
          are not uploaded to a server, and disappear the moment you close or reload the page.
          Read our <a href="/privacy">privacy policy</a>.
        </p>

        <label
          htmlFor="proof-consent"
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
            padding: "1rem",
            border: `1px solid ${consentError ? "#b3261e" : PALETTE.hairline}`,
            borderRadius: 3,
            background: PALETTE.white,
            cursor: "pointer",
          }}
        >
          <input
            id="proof-consent"
            type="checkbox"
            checked={project.consentGranted}
            onChange={(event) => onConsentChange(event.target.checked)}
            aria-invalid={consentError ? "true" : undefined}
            aria-describedby={consentError ? "consent-error" : undefined}
            style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, accentColor: PALETTE.accent, cursor: "pointer" }}
          />
          <span style={{ fontSize: "0.88rem", lineHeight: 1.65, color: PALETTE.text }}>
            I have permission to share the photographs, names and information I have uploaded, and I
            authorize Pressmark Studio to use them to produce this sample proof.
          </span>
        </label>
        {consentError && (
          <span id="consent-error" role="alert" style={IP.error}>
            {consentError}
          </span>
        )}
      </section>
    </div>
  );
}
