/*
 * Step 6 — processing.
 *
 * Renders whatever the renderer reports. It has no knowledge of whether the
 * work is simulated or real: it reads RENDER_STAGES, the current stageId and
 * the progress fraction from ProofJobStatus. When the mock is replaced by a
 * server-driven renderer reporting the same stage ids, this component does not
 * change.
 *
 * The "demonstration" banner is driven by `simulated`, so it disappears on its
 * own the day a real render is wired in — it cannot be left behind by accident.
 */

import { RENDER_STAGES } from "../models.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function ProofProcessing({ status, simulated, error, onRetry }) {
  const currentIndex = RENDER_STAGES.findIndex((stage) => stage.id === status.stageId);
  const percent = Math.round((status.progress || 0) * 100);

  return (
    <div style={{ display: "grid", gap: "2rem", maxWidth: 620 }}>
      {simulated && (
        <p style={{ ...IP.notice, borderLeftColor: PALETTE.ink }}>
          <strong style={{ color: PALETTE.text }}>Demonstration mode.</strong> This prototype simulates
          Pressmark's production pipeline in your browser. Your images are genuinely measured and your
          spreadsheet rows are genuinely counted, but no InDesign render is performed.
        </p>
      )}

      <div>
        <div
          className="ip-progress-track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Proof generation progress"
        >
          <div className="ip-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <p aria-live="polite" style={{ marginTop: "0.7rem", fontSize: "0.8rem", color: PALETTE.textMuted }}>
          {error ? "Stopped" : `${percent}% — ${status.message}`}
        </p>
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.85rem" }}>
        {RENDER_STAGES.map((stage, index) => {
          const done = currentIndex > index || status.state === "complete";
          const active = currentIndex === index && status.state !== "complete";
          return (
            <li
              key={stage.id}
              className="ip-stage"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.8rem",
                opacity: done || active ? 1 : 0.45,
                color: active ? PALETTE.text : PALETTE.textMuted,
                fontWeight: active ? 700 : 500,
                fontSize: "0.92rem",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: `1px solid ${done || active ? PALETTE.accent : PALETTE.hairline}`,
                  background: done ? PALETTE.accent : "transparent",
                  color: PALETTE.white,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done ? "✓" : ""}
              </span>
              {stage.label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" style={{ ...IP.notice, borderLeftColor: "#b3261e" }}>
          <strong style={{ display: "block", color: "#b3261e", marginBottom: "0.4rem" }}>
            We could not build the proof
          </strong>
          <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", lineHeight: 1.6 }}>{error}</p>
          <button type="button" className="ip-btn-primary" style={IP.btnPrimary} onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {!error && (
        <p style={{ fontFamily: FONT_STACK, fontSize: "1rem", lineHeight: 1.7, color: PALETTE.textMuted, margin: 0 }}>
          This usually takes under a minute. Please keep this tab open — your files live only in this
          browser session.
        </p>
      )}
    </div>
  );
}
