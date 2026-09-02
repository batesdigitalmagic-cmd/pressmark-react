/*
 * What we found in your spreadsheet.
 *
 * Shows the parse result and every issue analyzeRecords() detected, plus the
 * photograph reconciliation. This is the step where a customer discovers their
 * data problems before paying us to discover them — which is exactly the value
 * Instant Proof is meant to demonstrate.
 *
 * The first five records are shown as supplied. No values are logged.
 */

import { schemaFor } from "../csv/schemas.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

const SEVERITY = {
  error: { color: "#b3261e", label: "Needs attention" },
  warning: { color: "#b26a00", label: "Worth checking" },
  info: { color: PALETTE.accent, label: "For information" },
};

function Stat({ label, value, tone }) {
  return (
    <div style={{ background: PALETTE.white, padding: "0.9rem 1rem", display: "grid", gap: "0.15rem" }}>
      <span
        style={{
          fontSize: "0.6rem",
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: PALETTE.textMuted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONT_STACK,
          fontSize: "1.7rem",
          fontWeight: 900,
          lineHeight: 1,
          color: tone ?? PALETTE.text,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function DataReviewPanel({ data, matching }) {
  const schema = schemaFor(data.schemaId);
  const issues = data.analysis?.issues ?? [];
  const preview = data.records.slice(0, 5);

  /* Only columns that actually carry data, so the preview table does not run
     twenty columns wide with eighteen of them empty. */
  const previewColumns = (schema?.fields ?? [])
    .map((field) => field.key)
    .filter((key) => preview.some((record) => String(record[key] ?? "").trim() !== ""))
    .slice(0, 7);

  return (
    <div style={{ display: "grid", gap: "1.75rem" }}>
      <section aria-labelledby="parse-summary-heading" style={{ display: "grid", gap: "0.9rem" }}>
        <h3
          id="parse-summary-heading"
          style={{ fontFamily: FONT_STACK, fontSize: "1.4rem", fontWeight: 800, margin: 0, color: PALETTE.text }}
        >
          What we found
        </h3>

        <dl
          className="ip-metric-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 1,
            margin: 0,
            background: PALETTE.hairline,
            border: `1px solid ${PALETTE.hairline}`,
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <Stat label="Records" value={data.records.length} />
          <Stat label="Columns" value={data.headers.length} />
          {matching && <Stat label="Photos matched" value={matching.exact + matching.insensitive + matching.manual} />}
          {matching && (
            <Stat
              label="Unmatched"
              value={matching.unmatched}
              tone={matching.unmatched > 0 ? "#b3261e" : undefined}
            />
          )}
          {matching && (
            <Stat
              label="Unused photos"
              value={matching.unused.length}
              tone={matching.unused.length > 0 ? "#b26a00" : undefined}
            />
          )}
        </dl>

        <div>
          <span style={{ ...IP.label, marginBottom: "0.4rem" }}>Detected columns</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {data.headers.map((header) => {
              const mapped = Boolean(data.mapping[header]);
              return (
                <code
                  key={header}
                  title={mapped ? `Mapped to ${data.mapping[header]}` : "Not used by this template"}
                  style={{
                    padding: "0.22rem 0.55rem",
                    borderRadius: 2,
                    border: `1px solid ${mapped ? PALETTE.accent : PALETTE.hairline}`,
                    background: mapped ? PALETTE.paper : PALETTE.white,
                    color: mapped ? PALETTE.text : PALETTE.textMuted,
                    fontSize: "0.7rem",
                    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                  }}
                >
                  {header}
                </code>
              );
            })}
          </div>
        </div>
      </section>

      {preview.length > 0 && (
        <section aria-labelledby="preview-heading" style={{ display: "grid", gap: "0.7rem" }}>
          <h3
            id="preview-heading"
            style={{ fontFamily: FONT_STACK, fontSize: "1.25rem", fontWeight: 800, margin: 0, color: PALETTE.text }}
          >
            First {preview.length} record{preview.length === 1 ? "" : "s"}
          </h3>
          {/* Wide tables scroll inside their own container rather than pushing
              the page sideways on a phone. */}
          <div style={{ overflowX: "auto", border: `1px solid ${PALETTE.hairline}`, borderRadius: 3 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 520 }}>
              <thead>
                <tr>
                  {previewColumns.map((key) => (
                    <th
                      key={key}
                      scope="col"
                      style={{
                        textAlign: "left",
                        padding: "0.6rem 0.8rem",
                        borderBottom: `1px solid ${PALETTE.hairline}`,
                        background: PALETTE.paper,
                        fontSize: "0.63rem",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: PALETTE.textMuted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((record, index) => (
                  <tr key={index}>
                    {previewColumns.map((key) => (
                      <td
                        key={key}
                        style={{
                          padding: "0.6rem 0.8rem",
                          borderBottom: `1px solid ${PALETTE.hairline}`,
                          fontSize: "0.8rem",
                          color: PALETTE.text,
                          maxWidth: 220,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {record[key] || <span style={{ color: PALETTE.textMuted }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {issues.length > 0 && (
        <section aria-labelledby="issues-heading" style={{ display: "grid", gap: "0.7rem" }}>
          <h3
            id="issues-heading"
            style={{ fontFamily: FONT_STACK, fontSize: "1.25rem", fontWeight: 800, margin: 0, color: PALETTE.text }}
          >
            {issues.length} thing{issues.length === 1 ? "" : "s"} to know
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
            {issues.map((issue) => {
              const severity = SEVERITY[issue.severity] ?? SEVERITY.info;
              return (
                <li key={issue.id} style={{ ...IP.notice, borderLeftColor: severity.color }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.6rem",
                      fontWeight: 800,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: severity.color,
                      marginBottom: "0.3rem",
                    }}
                  >
                    {severity.label}
                  </span>
                  <strong style={{ display: "block", color: PALETTE.text, marginBottom: "0.2rem" }}>
                    {issue.message}
                  </strong>
                  {issue.detail}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
