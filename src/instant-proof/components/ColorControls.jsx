/*
 * Primary and accent colour, behind one mark in the composer.
 *
 * ── The controls a design actually uses ──
 *
 * Generated from BRAND_COLORS — the same list the API validates against and the
 * worker builds the InDesign handoff from — filtered to the swatches the chosen
 * design paints. The template carries all six; Directory Classic uses three, and
 * a control that moves nothing is worse than no control.
 *
 * A seventh colour is a row in BRAND_COLORS, a swatch in the template, and a key
 * in the design that wants it. This file does not change.
 *
 * There are no preset swatches. A customer choosing their organisation's
 * colours already knows what those colours are, and suggestions of ours would
 * be wrong answers occupying the space where the right one goes. Each control is
 * the shortest complete one — the colour they have, a picker, the hex, and a way
 * back to the template's own value.
 *
 * ── Two representations, one value ──
 *
 * A colour here is always `#RRGGBB`. The native picker and the typed field are
 * two ways of producing that one value, and both go through normalizeHex before
 * it is committed — the same function the API validates with, so nothing the
 * page accepts can be refused at submission and nothing it refuses can be
 * smuggled past.
 *
 * ── Why the typed field keeps its own draft ──
 *
 * "#7A1F3" is what "#7A1F35" looks like halfway through being typed. Committing
 * on every keystroke would either reject the customer mid-word or repaint the
 * preview in whatever the partial string happens to parse as. The field holds
 * its own text, and the committed colour only changes when that text is a whole
 * valid one.
 */

import { useId, useState } from "react";

import DesignPreviewCard from "./DesignPreviewCard.jsx";
import { CloseIcon } from "./Icons.jsx";
import { BRAND_COLORS, isValidHex, normalizeHex } from "../colors.js";

function ColorControl({ label, hint, value, defaultValue, onChange }) {
  const inputId = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);

  /*
   * Follow the committed value when it changes elsewhere — the picker, or Reset.
   *
   * Adjusted during render rather than in an effect: an effect would paint the
   * old text first and then correct it, and React re-runs this render before
   * anything reaches the screen. The normalizeHex comparison is what stops the
   * field rewriting itself under the customer's cursor — typing "7a1f35" commits
   * the same colour it already means, so there is nothing to replace.
   */
  if (value !== synced) {
    setSynced(value);
    if (normalizeHex(draft) !== value) setDraft(value);
  }

  const draftValid = isValidHex(draft);

  const commit = (next) => {
    const hex = normalizeHex(next);
    if (hex) onChange(hex);
  };

  return (
    <div className="ip-color-row">
      <label className="ip-color-label" htmlFor={inputId}>
        {label}
        {/* The swatch names mean nothing to a customer; what the colour does on
            the page is the only useful label for it. */}
        <span className="ip-color-hint">{hint}</span>
      </label>
      <div className="ip-color-inputs">
        {/*
          * The native picker IS the swatch. A separate chip beside it would be
          * the same information twice — this input paints itself in the colour
          * it holds.
          */}
        <input
          type="color"
          className="ip-color-input"
          id={inputId}
          value={value}
          onChange={(event) => commit(event.target.value)}
        />
        <input
          type="text"
          className="ip-hex"
          value={draft}
          spellCheck={false}
          maxLength={7}
          aria-label={`${label} hex value`}
          aria-invalid={draftValid ? undefined : true}
          onChange={(event) => {
            setDraft(event.target.value);
            commit(event.target.value);
          }}
          /* Leaving a half-typed value behind would show a hex that is not the
             colour on screen, so the field snaps back to the committed one. */
          onBlur={() => setDraft(value)}
        />
        <button
          type="button"
          className="ip-link-btn"
          /* Present but inert at the default, so the row does not reflow the
             moment a colour is chosen. */
          disabled={value === defaultValue}
          onClick={() => onChange(defaultValue)}
        >
          Reset
        </button>
      </div>
      {!draftValid && (
        <p className="ip-note ip-error" role="alert">
          Enter a six-digit hex colour, such as {defaultValue}.
        </p>
      )}
    </div>
  );
}

export default function ColorControls({ colors, defaults, design, keys, onChange, onClose }) {
  return (
    <div className="ip-colors">
      {/* Pinned to the top of the panel as it scrolls, so the way out is always
          in reach — on a phone the panel covers most of the screen, and
          tapping outside it is not obvious. */}
      {onClose && (
        <div className="ip-colors-head">
          <span className="ip-colors-title">Colours</span>
          <button type="button" className="ip-chat-close" aria-label="Close colours" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      )}
      {BRAND_COLORS.filter((color) => keys.includes(color.key)).map((color) => (
        <ColorControl
          key={color.key}
          label={color.label}
          hint={color.hint}
          value={colors[color.key]}
          defaultValue={defaults[color.key]}
          /*
           * An updater, not a new object built from the `colors` prop.
           *
           * Spreading the captured prop is only correct while no two changes
           * land in the same batch. They can: React batches events, and the
           * second change would then build from the same stale object and
           * silently revert the first. With six controls that is no longer
           * hypothetical.
           */
          onChange={(hex) => onChange((current) => ({ ...current, [color.key]: hex }))}
        />
      ))}
      {/* The preview stays live, but it lives here rather than occupying the
          page: it is only meaningful while a colour is being chosen. */}
      {design && <DesignPreviewCard design={design} colors={colors} keys={keys} />}
    </div>
  );
}
