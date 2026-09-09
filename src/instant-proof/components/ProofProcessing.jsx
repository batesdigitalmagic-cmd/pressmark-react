/*
 * Step 3 — processing.
 *
 * Renders whatever the renderer reports. It has no knowledge of whether the
 * work is simulated or real: it reads RENDER_STAGES, the current stageId and
 * the progress fraction from ProofJobStatus. When the mock is replaced by a
 * server-driven renderer reporting the same stage ids, this does not change.
 *
 * The "demonstration" banner is driven by `simulated`, so it disappears on its
 * own the day a real render is wired in — it cannot be left behind by accident.
 *
 * Styling comes from the Instant Proof system (theme.css.js): gold labels,
 * black display type, a navy progress fill, thin gold rules.
 */

import { RENDER_STAGES } from "../models.js";

export default function ProofProcessing({ status, simulated, error, onRetry }) {
  const currentIndex = RENDER_STAGES.findIndex((stage) => stage.id === status.stageId);
  const percent = Math.round((status.progress || 0) * 100);
  const complete = status.state === "complete";

  return (
    <div style={{ display: "grid", gap: "var(--proof-space-6)", maxWidth: 620 }}>
      {simulated && (
        <p
          className="ip-note"
          style={{
            padding: "var(--proof-space-4)",
            borderLeft: "3px solid var(--proof-gold)",
            background: "var(--proof-gold-soft)",
            borderRadius: "var(--proof-radius-sm)",
          }}
        >
          <strong>Demonstration mode.</strong> This prototype runs Pressmark's production pipeline
          in your browser. Your images are genuinely measured and your spreadsheet rows genuinely
          counted, but no InDesign render is performed.
        </p>
      )}

      <div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Proof generation progress"
          style={{
            height: 6,
            borderRadius: 99,
            overflow: "hidden",
            background: "var(--proof-hairline)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: "var(--proof-navy)",
              transition: "width 0.45s ease",
            }}
          />
        </div>
        <p
          aria-live="polite"
          className="ip-note"
          style={{ marginTop: "var(--proof-space-3)", fontWeight: 700 }}
        >
          {error ? "Stopped" : `${percent}% — ${status.message}`}
        </p>
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--proof-space-3)" }}>
        {RENDER_STAGES.map((stage, index) => {
          const done = currentIndex > index || complete;
          const active = currentIndex === index && !complete;
          return (
            <li
              key={stage.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--proof-space-3)",
                opacity: done || active ? 1 : 0.4,
                color: active ? "var(--proof-ink)" : "var(--proof-ink-soft)",
                fontWeight: active ? 800 : 500,
                fontSize: "0.95rem",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: `1.5px solid ${done || active ? "var(--proof-gold)" : "var(--proof-hairline)"}`,
                  background: done ? "var(--proof-gold)" : "transparent",
                  color: "#fff",
                  fontSize: "0.68rem",
                  fontWeight: 900,
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
        <div
          role="alert"
          style={{
            padding: "var(--proof-space-4)",
            borderLeft: "3px solid var(--proof-danger)",
            background: "rgba(179, 38, 30, 0.06)",
            borderRadius: "var(--proof-radius-sm)",
          }}
        >
          <strong style={{ display: "block", color: "var(--proof-danger)", marginBottom: "var(--proof-space-2)" }}>
            We could not build your proof
          </strong>
          <p className="ip-note" style={{ marginBottom: "var(--proof-space-4)" }}>{error}</p>
          <button type="button" className="ip-btn ip-btn-primary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {!error && (
        <p className="ip-note ip-muted">
          This usually takes under a minute. Please keep this tab open — your files live only in
          this browser session.
        </p>
      )}
    </div>
  );
}
