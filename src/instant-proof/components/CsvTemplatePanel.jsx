/*
 * The CSV template offer, shown in the content step.
 *
 * Which templates appear is driven by the publication type's `schemaIds`, so a
 * yearbook is offered the portrait roster, an event program is offered both the
 * schedule and the sponsor sheet, and nothing has to be special-cased here.
 *
 * The files are static assets under public/csv-templates/. They are ordinary
 * downloads — a plain <a download>, no JavaScript, no blob construction.
 */

import { schemaFor } from "../csv/schemas.js";
import { schemaIdsFor } from "../publications.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

const CODE_STYLE = {
  padding: "0.1rem 0.35rem",
  borderRadius: 2,
  background: PALETTE.white,
  border: `1px solid ${PALETTE.hairline}`,
  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
  fontSize: "0.85em",
};

const Code = ({ children }) => <code style={CODE_STYLE}>{children}</code>;

function SchemaCard({ schema }) {
  const required = schema.fields.filter((field) => field.required);
  const optional = schema.fields.filter((field) => !field.required);

  return (
    <div style={{ ...IP.card, display: "grid", gap: "0.9rem", alignContent: "start" }}>
      <div>
        <h4 style={{ fontFamily: FONT_STACK, fontSize: "1.15rem", fontWeight: 800, margin: "0 0 0.3rem", color: PALETTE.text }}>
          {schema.label}
        </h4>
        <p style={{ fontSize: "0.82rem", lineHeight: 1.55, color: PALETTE.textMuted, margin: 0 }}>
          {schema.description}
        </p>
      </div>

      <a
        href={schema.templateFile}
        download
        className="ip-btn-primary"
        style={{ ...IP.btnPrimary, textAlign: "center" }}
      >
        Download CSV Template
      </a>

      <div style={{ display: "grid", gap: "0.6rem" }}>
        <div>
          <span
            style={{
              display: "block",
              fontSize: "0.62rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: PALETTE.accent,
              marginBottom: "0.35rem",
            }}
          >
            Required columns
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {required.map((field) => (
              <code
                key={field.key}
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: 2,
                  background: PALETTE.ink,
                  color: PALETTE.white,
                  fontSize: "0.68rem",
                  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                }}
              >
                {field.key}
              </code>
            ))}
          </div>
        </div>

        <div>
          <span
            style={{
              display: "block",
              fontSize: "0.62rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: PALETTE.textMuted,
              marginBottom: "0.35rem",
            }}
          >
            Optional columns
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {optional.map((field) => (
              <code
                key={field.key}
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: 2,
                  background: PALETTE.paper,
                  border: `1px solid ${PALETTE.hairline}`,
                  color: PALETTE.textMuted,
                  fontSize: "0.68rem",
                  fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                }}
              >
                {field.key}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CsvTemplatePanel({ publicationTypeId }) {
  const schemas = schemaIdsFor(publicationTypeId).map(schemaFor).filter(Boolean);
  if (schemas.length === 0) return null;

  const imageColumns = [...new Set(schemas.map((schema) => schema.imageField).filter(Boolean))];

  return (
    <section aria-labelledby="csv-templates-heading" style={{ display: "grid", gap: "1rem" }}>
      <div>
        <h3
          id="csv-templates-heading"
          style={{ fontFamily: FONT_STACK, fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.35rem", color: PALETTE.text }}
        >
          {schemas.length === 1 ? "Recommended spreadsheet" : "Recommended spreadsheets"}
        </h3>
        <p style={{ fontSize: "0.88rem", lineHeight: 1.6, color: PALETTE.textMuted, margin: 0, maxWidth: 640 }}>
          Start from our template and your data will merge without any cleanup. Already have a
          spreadsheet? Upload it anyway — we will help you map your columns in the next step.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
        {schemas.map((schema) => (
          <SchemaCard key={schema.id} schema={schema} />
        ))}
      </div>

      {imageColumns.length > 0 && (
        <p style={{ ...IP.notice, margin: 0 }}>
          <strong style={{ color: PALETTE.text }}>Matching photographs to records:</strong> the{" "}
          {imageColumns.map((column, index) => (
            <span key={column}>
              {index > 0 && " and "}
              <Code>{column}</Code>
            </span>
          ))}{" "}
          column must match the uploaded image filename exactly, including the extension —{" "}
          <Code>whitfield-ava.jpg</Code>, not <Code>whitfield-ava</Code>. Capitalization differences
          are forgiven and reported; anything else has to be matched by hand.
        </p>
      )}

    </section>
  );
}
