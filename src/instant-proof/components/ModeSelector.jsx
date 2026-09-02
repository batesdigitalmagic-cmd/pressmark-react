/*
 * How a visitor wants to build their proof.
 *
 * Quick Photo Proof is the recommended path and is presented as such: it is
 * first, it is larger, and it carries the badge. Spreadsheet mode keeps every
 * capability it had — schemas, column mapping, filename matching, validation,
 * the production summary — for the customer who already has a roster.
 */

import { PROOF_MODES } from "../models.js";
import { PALETTE, FONT_STACK } from "../styles.js";

const OPTIONS = [
  {
    id: PROOF_MODES.photo,
    label: "Quick Photo Proof",
    lead: "Add photographs from your phone or computer and see a designed proof in under a minute.",
    points: ["No spreadsheet needed", "No email required", "Names and titles optional"],
    recommended: true,
  },
  {
    id: PROOF_MODES.data,
    label: "Upload Spreadsheet and Photos",
    lead: "Already have a roster? Bring a CSV and we will match every photograph to its record.",
    points: ["Standardised CSV templates", "Column mapping and validation", "Filename matching report"],
    recommended: false,
  },
];

export default function ModeSelector({ value, onChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="How would you like to build your proof?"
      className="ip-choice-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: "0.9rem" }}
    >
      {OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className="ip-choice"
            onClick={() => onChange(option.id)}
            style={{
              display: "grid",
              gap: "0.5rem",
              alignContent: "start",
              /* The recommended path is visibly the default even before it is
                 chosen — an unmarked pair of equal options is not a
                 recommendation. */
              borderColor: selected ? PALETTE.accent : option.recommended ? PALETTE.border : PALETTE.hairline,
              background: option.recommended && !selected ? PALETTE.paper : undefined,
            }}
          >
            {option.recommended && (
              <span
                style={{
                  justifySelf: "start",
                  padding: "0.16rem 0.5rem",
                  borderRadius: 99,
                  background: PALETTE.accent,
                  color: "#000",
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Recommended
              </span>
            )}

            <span style={{ fontFamily: FONT_STACK, fontSize: "1.3rem", fontWeight: 800, lineHeight: 1.15, color: PALETTE.text }}>
              {option.label}
            </span>
            <span style={{ fontSize: "0.85rem", lineHeight: 1.55, color: PALETTE.textMuted }}>
              {option.lead}
            </span>

            <span style={{ display: "grid", gap: "0.3rem", marginTop: "0.25rem" }}>
              {option.points.map((point) => (
                <span key={point} style={{ display: "flex", gap: "0.45rem", alignItems: "flex-start", fontSize: "0.78rem", color: PALETTE.textMuted }}>
                  <span aria-hidden="true" style={{ color: PALETTE.accent, fontWeight: 800 }}>·</span>
                  {point}
                </span>
              ))}
            </span>

            {selected && (
              <span style={{ marginTop: "0.3rem", fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: PALETTE.accent }}>
                ✓ Selected
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
