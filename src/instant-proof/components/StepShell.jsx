/*
 * The frame every step sits in: the step counter, heading and lead, the
 * content, and the action bar.
 *
 * ── The action bar ──
 *
 * Sticky at the bottom on a phone so the primary action is always under a
 * thumb, and padded by env(safe-area-inset-bottom) so it clears an iPhone's
 * home indicator. A spacer sits above it in the flow so the bar can never cover
 * the last section of content. On a desktop it stops being sticky — there is no
 * reach problem there, and a pinned bar would just eat vertical space.
 *
 * Continue is disabled until the step's requirements are met, and the reason is
 * stated in text above the bar rather than left for the visitor to guess.
 */

export default function StepShell({
  step,
  totalSteps,
  title,
  lead,
  headingRef,
  children,
  onBack,
  onContinue,
  continueLabel,
  continueDisabled,
  blockingReason,
}) {
  return (
    <>
      <div className="ip-page">
        <header className="ip-section-tight">
          <p className="ip-eyebrow">
            Step {step} of {totalSteps}
          </p>
          <h1 className="ip-h1" ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
            {title}
          </h1>
          {lead && <p className="ip-lead">{lead}</p>}
        </header>

        {children}

        <div className="ip-actions-spacer" />
      </div>

      <div className="ip-actions">
        <div className="ip-page" style={{ padding: 0, display: "flex", gap: "var(--proof-space-3)", alignItems: "center", width: "100%" }}>
          {onBack && (
            <button type="button" className="ip-btn ip-btn-ghost" onClick={onBack}>
              Back
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* aria-live so the reason is announced when it changes, and
                aria-describedby so it is read with the button itself. */}
            {continueDisabled && blockingReason && (
              <p className="ip-actions-why" id="continue-why" aria-live="polite">
                {blockingReason}
              </p>
            )}
            <button
              type="button"
              className="ip-btn ip-btn-primary ip-btn-block"
              onClick={onContinue}
              disabled={continueDisabled}
              aria-describedby={continueDisabled && blockingReason ? "continue-why" : undefined}
            >
              {continueLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
