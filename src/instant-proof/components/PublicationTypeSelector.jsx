/*
 * Step 1 — publication type.
 *
 * Rendered entirely from PUBLICATION_CONFIGS. Adding a tenth publication type
 * changes nothing here.
 *
 * Implemented as a radiogroup of buttons rather than native radios so the
 * whole card is the target. Roving focus is not needed because each button is
 * independently tabbable and carries aria-checked, which is the pattern screen
 * readers handle most predictably for a small, always-visible set.
 */

import { PUBLICATION_CONFIGS } from "../publications.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function PublicationTypeSelector({ value, onChange, error }) {
  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Publication type"
        aria-describedby={error ? "publication-type-error" : undefined}
        className="ip-choice-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "0.9rem",
        }}
      >
        {PUBLICATION_CONFIGS.map((config) => {
          const selected = value === config.id;
          return (
            <button
              key={config.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className="ip-choice"
              onClick={() => onChange(config.id)}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: FONT_STACK,
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  lineHeight: 1.2,
                  color: PALETTE.text,
                  marginBottom: "0.3rem",
                }}
              >
                {config.label}
              </span>
              <span style={{ display: "block", fontSize: "0.82rem", lineHeight: 1.55, color: PALETTE.textMuted }}>
                {config.blurb}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: "0.7rem",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: selected ? PALETTE.accent : PALETTE.textMuted,
                }}
              >
                {selected ? "Selected" : `${config.suggestedProofPages} sample pages`}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <span id="publication-type-error" role="alert" style={{ ...IP.error, marginTop: "0.8rem" }}>
          {error}
        </span>
      )}
    </div>
  );
}
