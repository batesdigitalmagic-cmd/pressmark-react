/*
 * The production summary.
 *
 * Metrics carrying `estimated: true`, and the whole panel when the result is
 * simulated, are labelled as such. A customer deciding whether to hire us
 * should never be unsure which numbers came from their files and which came
 * from a model.
 */

import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function ProductionReport({ result }) {
  return (
    <section aria-labelledby="production-report-heading" style={{ display: "grid", gap: "1.25rem" }}>
      <div>
        <h3
          id="production-report-heading"
          style={{ fontFamily: FONT_STACK, fontSize: "clamp(1.4rem, 3vw, 1.9rem)", fontWeight: 900, margin: "0 0 0.4rem", color: PALETTE.text }}
        >
          Production summary
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: PALETTE.textMuted, margin: 0 }}>
          {result.simulated
            ? "File counts, record counts and image measurements below are read from the files you supplied. Page counts and time savings are demonstration figures."
            : "Measured from your files during the render."}
        </p>
      </div>

      <dl
        className="ip-metric-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1px",
          margin: 0,
          background: PALETTE.hairline,
          border: `1px solid ${PALETTE.hairline}`,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {result.metrics.map((metric) => (
          <div key={metric.id} style={{ background: PALETTE.white, padding: "1.1rem 1rem", display: "grid", gap: "0.25rem" }}>
            <dt
              style={{
                fontSize: "0.64rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: PALETTE.textMuted,
              }}
            >
              {metric.label}
            </dt>
            <dd
              style={{
                margin: 0,
                fontFamily: FONT_STACK,
                fontSize: "clamp(1.5rem, 3.5vw, 2.1rem)",
                fontWeight: 900,
                lineHeight: 1,
                color: PALETTE.text,
              }}
            >
              {metric.value}
            </dd>
            {metric.detail && (
              <dd style={{ margin: 0, fontSize: "0.72rem", lineHeight: 1.5, color: PALETTE.textMuted }}>
                {metric.detail}
                {metric.estimated && (
                  <span
                    style={{
                      display: "inline-block",
                      marginLeft: "0.4rem",
                      padding: "0.1rem 0.4rem",
                      borderRadius: 99,
                      background: PALETTE.paper,
                      border: `1px solid ${PALETTE.hairline}`,
                      fontSize: "0.6rem",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    Estimate
                  </span>
                )}
              </dd>
            )}
          </div>
        ))}
      </dl>

      {result.warnings.length > 0 && (
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <h4
            style={{
              fontSize: "0.66rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: PALETTE.accent,
              margin: 0,
            }}
          >
            Production notes
          </h4>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
            {result.warnings.map((warning) => (
              <li
                key={warning.id}
                style={{
                  ...IP.notice,
                  borderLeftColor: warning.severity === "caution" ? "#b3261e" : PALETTE.accent,
                }}
              >
                <strong style={{ display: "block", color: PALETTE.text, marginBottom: "0.25rem" }}>
                  {warning.message}
                </strong>
                {warning.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
