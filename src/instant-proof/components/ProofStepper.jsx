/*
 * Step indicator.
 *
 * Presented as an ordered list rather than a set of buttons: the steps are
 * progress feedback, not navigation. Moving between steps happens through the
 * Back and Continue controls, which run validation. An `aria-current` marker
 * and a visually hidden status line give assistive technology the same
 * information the dots give everyone else.
 */

import { PALETTE } from "../styles.js";

export default function ProofStepper({ steps, currentIndex }) {
  return (
    <nav aria-label="Proof progress" className="ip-no-print">
      <p className="ip-sr-only" role="status">
        Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
      </p>
      <ol
        className="ip-stepper"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          listStyle: "none",
          margin: 0,
          padding: "0 0 0.4rem",
        }}
      >
        {steps.map((step, index) => {
          const state = index === currentIndex ? "current" : index < currentIndex ? "done" : "todo";
          return (
            <li
              key={step.id}
              className="ip-step"
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}
            >
              <span className="ip-step-dot" aria-hidden="true">
                {state === "done" ? "✓" : index + 1}
              </span>
              <span
                className="ip-step-label"
                style={{
                  fontSize: "0.72rem",
                  letterSpacing: "0.04em",
                  color: PALETTE.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{
                    width: "clamp(12px, 3vw, 34px)",
                    height: 1,
                    background: index < currentIndex ? PALETTE.accent : PALETTE.hairline,
                    margin: "0 0.2rem",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
