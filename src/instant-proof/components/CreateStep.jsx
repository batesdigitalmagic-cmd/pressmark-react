/*
 * Step 1 — Create.
 *
 * Combines what used to be three screens: how to build it, what is being made,
 * and which design. All three are cheap choices with sensible defaults, so
 * putting them together removes two taps without crowding anything.
 *
 * ── Semantics ──
 *
 * Each group is a fieldset with a legend and a radiogroup of real radio
 * semantics, styled as outlined buttons. Selection is never signalled by colour
 * alone: the publication rows gain a filled tick, the method cards swap from
 * outline to a filled gold panel with an inset keyline, and the carousel's
 * chosen slide gains a border and scale.
 */

import { PUBLICATION_CONFIGS } from "../publications.js";
import { PROOF_MODES } from "../models.js";
import DesignCarousel from "./DesignCarousel.jsx";

/*
 * Labels wrap naturally rather than carrying hand-set line breaks. The
 * reference broke "Upload Spreadsheet" across three lines because the button
 * was a tall square; at normal button height the text should decide where it
 * wraps, so it stays right at 320px and on a desktop alike.
 */
const METHODS = [
  {
    id: PROOF_MODES.photo,
    label: "Quick Photo Proof",
    caption: "Add photos from your phone or computer",
  },
  {
    id: PROOF_MODES.data,
    label: "Upload Spreadsheet",
    caption: "Bring CSV data for Data Merge",
  },
];

export default function CreateStep({
  mode,
  onModeChange,
  publicationTypeId,
  onPublicationChange,
  templateId,
  inputMode,
  onTemplateChange,
  onPreview,
  proofPages,
  errors,
}) {
  return (
    <>
      {inputMode !== "csv" && <fieldset className="ip-fieldset ip-section">
        <legend className="ip-legend">
          <span className="ip-label">How would you like to build it</span>
        </legend>

        <div className="ip-methods" role="radiogroup" aria-label="How would you like to build it">
          {METHODS.map((method) => {
            const isSelected = mode === method.id;
            return (
              <div className="ip-method" key={method.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className="ip-method-btn"
                  onClick={() => onModeChange(method.id)}
                >
                  {method.label}
                </button>
                {/* Outside the control so the radio's name stays short. */}
                <span className="ip-method-cap" aria-hidden="true">
                  {method.caption}
                </span>
                <span className="ip-sr-only" id={`method-${method.id}-desc`}>
                  {method.caption}
                </span>
              </div>
            );
          })}
        </div>
      </fieldset>}

      <fieldset className="ip-fieldset ip-section">
        <legend className="ip-legend">
          <span className="ip-sr-only">What are you creating?</span>
        </legend>

        <div
          className="ip-pubs"
          role="radiogroup"
          aria-label="Publication type"
          aria-describedby={errors.publicationTypeId ? "pub-error" : undefined}
        >
          {PUBLICATION_CONFIGS.map((config) => {
            const isSelected = publicationTypeId === config.id;
            return (
              <button
                key={config.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className="ip-pub"
                onClick={() => onPublicationChange(config.id)}
              >
                <span className="ip-pub-tick" aria-hidden="true">
                  ✓
                </span>
                {config.label}
              </button>
            );
          })}
        </div>

        {errors.publicationTypeId && (
          <p id="pub-error" role="alert" className="ip-note" style={{ color: "var(--proof-danger)", marginTop: "var(--proof-space-3)" }}>
            {errors.publicationTypeId}
          </p>
        )}

        <p className="ip-note" style={{ marginTop: "var(--proof-space-3)" }}>
          {proofPages} Page Proof
        </p>
      </fieldset>

      <section className="ip-section-tight">
        <span className="ip-label">Which Pressmark design?</span>
      </section>

      <div className="ip-bleed">
        <hr className="ip-rule" />
      </div>

      <div className="ip-section-tight">
        <DesignCarousel
          publicationTypeId={publicationTypeId}
          value={templateId}
          onChange={onTemplateChange}
          onPreview={onPreview}
        />
      </div>

      <div className="ip-bleed" style={{ marginTop: "var(--proof-space-5)" }}>
        <hr className="ip-rule" />
      </div>
    </>
  );
}
