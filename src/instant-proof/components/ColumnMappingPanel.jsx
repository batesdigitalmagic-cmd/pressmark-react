/*
 * Column mapping.
 *
 * Shown when the uploaded headers are not already the Pressmark standard.
 *
 * The governing rule, restated because it is the whole point: a suggestion is
 * shown, never silently applied. Every proposal is a visible <select> the
 * customer can change, and anything the matcher was unsure about is flagged in
 * amber so their eye goes there first. A wrong mapping is invisible until the
 * book is printed.
 */

import { fieldOf, schemaFor } from "../csv/schemas.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

const CONFIDENCE = {
  exact: { label: "Exact match", color: "#1b7f4f", note: "This column already uses the Pressmark name." },
  strong: { label: "Suggested", color: PALETTE.accent, note: "A confident guess — please confirm." },
  weak: { label: "Check this", color: "#b26a00", note: "More than one field could claim this column." },
  none: { label: "Not mapped", color: PALETTE.textMuted, note: "Choose a field, or leave it out." },
};

export default function ColumnMappingPanel({ schemaId, proposals, onChange, sampleRows }) {
  const schema = schemaFor(schemaId);
  if (!schema) return null;

  /* A field already claimed by another column is disabled in every other
     dropdown — two columns feeding display_name would silently drop one. */
  const claimed = new Map();
  proposals.forEach((proposal, index) => {
    if (proposal.field) claimed.set(proposal.field, index);
  });

  const setField = (index, field) => {
    const next = proposals.map((proposal, i) =>
      i === index ? { ...proposal, field: field || null, confidence: field ? "confirmed" : "none" } : proposal
    );
    /* Selecting a field that another column holds releases it there, rather
       than silently creating a duplicate. */
    if (field) {
      const previous = claimed.get(field);
      if (previous !== undefined && previous !== index) {
        next[previous] = { ...next[previous], field: null, confidence: "none" };
      }
    }
    onChange(next);
  };

  const uncertain = proposals.filter((proposal) => proposal.confidence === "weak").length;

  return (
    <section aria-labelledby="mapping-heading" style={{ display: "grid", gap: "1.15rem" }}>
      <div>
        <h3
          id="mapping-heading"
          style={{ fontFamily: FONT_STACK, fontSize: "1.4rem", fontWeight: 800, margin: "0 0 0.35rem", color: PALETTE.text }}
        >
          Match your columns to ours
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: PALETTE.textMuted, margin: 0, maxWidth: 660 }}>
          Your spreadsheet uses its own column names. We have suggested what each one probably means —
          please confirm or correct them. Nothing is assumed on your behalf.
          {uncertain > 0 && (
            <>
              {" "}
              <strong style={{ color: "#b26a00" }}>
                {uncertain} {uncertain === 1 ? "column needs" : "columns need"} a closer look.
              </strong>
            </>
          )}
        </p>
      </div>

      <div style={{ display: "grid", gap: "0.6rem" }}>
        {proposals.map((proposal, index) => {
          const meta = CONFIDENCE[proposal.confidence] ?? CONFIDENCE.none;
          const sample = sampleRows
            .map((row) => row[proposal.header])
            .find((value) => String(value ?? "").trim() !== "");

          return (
            <div
              key={proposal.header}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
                alignItems: "center",
                gap: "0.9rem",
                padding: "0.85rem 1rem",
                border: `1px solid ${proposal.confidence === "weak" ? "#e0b070" : PALETTE.hairline}`,
                borderRadius: 3,
                background: proposal.confidence === "weak" ? "#fdf8f0" : PALETTE.white,
              }}
              className="ip-mapping-row"
            >
              <div style={{ minWidth: 0 }}>
                <code
                  style={{
                    display: "block",
                    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: PALETTE.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {proposal.header}
                </code>
                {sample && (
                  <span
                    style={{
                      display: "block",
                      marginTop: "0.2rem",
                      fontSize: "0.72rem",
                      color: PALETTE.textMuted,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    e.g. {sample}
                  </span>
                )}
              </div>

              <span aria-hidden="true" style={{ color: PALETTE.textMuted, fontSize: "1rem" }}>
                →
              </span>

              <div style={{ minWidth: 0 }}>
                <label htmlFor={`map-${index}`} className="ip-sr-only">
                  Pressmark field for your column {proposal.header}
                </label>
                <select
                  id={`map-${index}`}
                  className="ip-input"
                  value={proposal.field ?? ""}
                  onChange={(event) => setField(index, event.target.value)}
                  style={{ ...IP.input, padding: "0.5rem 0.7rem", fontSize: "0.85rem", cursor: "pointer" }}
                >
                  <option value="">— Do not use this column —</option>
                  {schema.fields.map((field) => {
                    const takenBy = claimed.get(field.key);
                    const taken = takenBy !== undefined && takenBy !== index;
                    return (
                      <option key={field.key} value={field.key} disabled={taken}>
                        {field.label}
                        {field.required ? " (required)" : ""}
                        {taken ? ` — used by "${proposals[takenBy].header}"` : ""}
                      </option>
                    );
                  })}
                </select>
                <span
                  style={{
                    display: "block",
                    marginTop: "0.25rem",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: meta.color,
                  }}
                >
                  {proposal.confidence === "confirmed" ? "Set by you" : meta.label}
                  {proposal.alternatives?.length > 0 && proposal.confidence === "weak" && (
                    <span style={{ fontWeight: 400, color: PALETTE.textMuted }}>
                      {" "}
                      — could also be{" "}
                      {proposal.alternatives
                        .map((key) => fieldOf(schema, key)?.label ?? key)
                        .join(", ")}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
