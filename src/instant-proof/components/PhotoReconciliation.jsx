/*
 * Photograph reconciliation.
 *
 * Lists every record whose named file we could not find, and lets the customer
 * pick the right upload by hand. Manual selection exists because the matching
 * rules deliberately refuse to guess: "smith_j.jpg" and "smith_jane.jpg" are a
 * coin flip, and a coin flip here puts the wrong face under the wrong name.
 *
 * Only shown when there is something to reconcile.
 */

import { useState } from "react";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function PhotoReconciliation({ matching, assets, overrides, onOverride }) {
  const [expanded, setExpanded] = useState(false);
  if (!matching) return null;

  const unmatched = matching.matches.filter((match) => match.how === "none");
  const nothingToDo =
    unmatched.length === 0 && matching.unused.length === 0 && matching.duplicates.length === 0;

  return (
    <section aria-labelledby="reconciliation-heading" style={{ display: "grid", gap: "1rem" }}>
      <div>
        <h3
          id="reconciliation-heading"
          style={{ fontFamily: FONT_STACK, fontSize: "1.4rem", fontWeight: 800, margin: "0 0 0.35rem", color: PALETTE.text }}
        >
          Photograph matching
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: PALETTE.textMuted, margin: 0, maxWidth: 660 }}>
          {nothingToDo
            ? "Every record found its photograph and every upload was used."
            : "We match filenames exactly first, then ignoring capitalization. Anything left over is below — we will not guess at a partial match."}
        </p>
      </div>

      <dl
        className="ip-metric-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 1,
          margin: 0,
          background: PALETTE.hairline,
          border: `1px solid ${PALETTE.hairline}`,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {[
          { label: "Exact matches", value: matching.exact },
          { label: "By capitalization", value: matching.insensitive, tone: matching.insensitive > 0 ? "#b26a00" : undefined },
          { label: "Chosen by you", value: matching.manual },
          { label: "Unmatched", value: matching.unmatched, tone: matching.unmatched > 0 ? "#b3261e" : undefined },
          { label: "Unused uploads", value: matching.unused.length, tone: matching.unused.length > 0 ? "#b26a00" : undefined },
          { label: "Duplicate refs", value: matching.duplicates.length, tone: matching.duplicates.length > 0 ? "#b3261e" : undefined },
        ].map((stat) => (
          <div key={stat.label} style={{ background: PALETTE.white, padding: "0.85rem 0.9rem", display: "grid", gap: "0.15rem" }}>
            <dt style={{ fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.textMuted }}>
              {stat.label}
            </dt>
            <dd style={{ margin: 0, fontFamily: FONT_STACK, fontSize: "1.6rem", fontWeight: 900, lineHeight: 1, color: stat.tone ?? PALETTE.text }}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {unmatched.length > 0 && (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            style={{
              ...IP.btnGhost,
              padding: "0.7rem 1.1rem",
              textAlign: "left",
              justifySelf: "start",
              textTransform: "none",
              letterSpacing: "normal",
              fontSize: "0.85rem",
            }}
          >
            {expanded ? "Hide" : "Match"} {unmatched.length} unmatched record
            {unmatched.length === 1 ? "" : "s"} {expanded ? "▲" : "▼"}
          </button>

          {expanded && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
              {unmatched.map((match) => {
                const selectId = `photo-pick-${match.rowNumber}`;
                return (
                  <li
                    key={match.rowNumber}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                      gap: "0.85rem",
                      alignItems: "center",
                      padding: "0.8rem 1rem",
                      border: `1px solid ${PALETTE.hairline}`,
                      borderRadius: 3,
                      background: PALETTE.white,
                    }}
                    className="ip-mapping-row"
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: PALETTE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Row {match.rowNumber}
                      </span>
                      <code
                        style={{
                          display: "block",
                          marginTop: "0.15rem",
                          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                          fontSize: "0.74rem",
                          color: "#b3261e",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {match.requested}
                      </code>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor={selectId} className="ip-sr-only">
                        Choose an uploaded image for row {match.rowNumber}
                      </label>
                      <select
                        id={selectId}
                        className="ip-input"
                        value={overrides[String(match.rowNumber)] ?? ""}
                        onChange={(event) => onOverride(String(match.rowNumber), event.target.value)}
                        style={{ ...IP.input, padding: "0.5rem 0.7rem", fontSize: "0.82rem", cursor: "pointer" }}
                      >
                        <option value="">— Leave as a placeholder —</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {matching.unused.length > 0 && (
        <p style={{ ...IP.notice, margin: 0 }}>
          <strong style={{ color: PALETTE.text }}>
            {matching.unused.length} uploaded photograph{matching.unused.length === 1 ? "" : "s"} not referenced by any record:
          </strong>{" "}
          {matching.unused.slice(0, 8).map((asset) => asset.name).join(", ")}
          {matching.unused.length > 8 ? `, and ${matching.unused.length - 8} more` : ""}. These will
          not appear in the sample.
        </p>
      )}

      {matching.duplicates.length > 0 && (
        <p style={{ ...IP.notice, margin: 0, borderLeftColor: "#b3261e" }}>
          <strong style={{ color: PALETTE.text }}>
            {matching.duplicates.length} photograph{matching.duplicates.length === 1 ? " is" : "s are"} referenced more than once:
          </strong>{" "}
          {matching.duplicates
            .slice(0, 4)
            .map((entry) => `"${entry.filename}" on rows ${entry.rows.join(", ")}`)
            .join("; ")}
          . Usually a copy-paste error in the spreadsheet.
        </p>
      )}
    </section>
  );
}
