/*
 * Reusable form primitives for the Instant Proof flow.
 *
 * Defined as real components in their own module — not as inline helpers the
 * way App.jsx does it — because these are stable across renders. App.jsx's
 * comment about remounting applies to helpers declared *inside* a component
 * body; module-level components have no such problem and keep focus fine.
 *
 * Every control wires label → input via htmlFor/id, exposes aria-invalid and
 * aria-describedby, and renders its error with role="alert" so screen readers
 * announce validation without the user hunting for it.
 */

import { IP } from "../styles.js";

function describedBy(id, hint, error) {
  const ids = [];
  if (hint) ids.push(`${id}-hint`);
  if (error) ids.push(`${id}-error`);
  return ids.length ? ids.join(" ") : undefined;
}

function Label({ htmlFor, children, required }) {
  return (
    <label htmlFor={htmlFor} style={IP.label}>
      {children}
      {required && (
        <span style={{ color: "#b3261e" }} aria-hidden="true">
          {" *"}
        </span>
      )}
      {required && <span className="ip-sr-only"> (required)</span>}
    </label>
  );
}

function Feedback({ id, hint, error }) {
  return (
    <>
      {hint && (
        <span id={`${id}-hint`} style={IP.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" style={IP.error}>
          {error}
        </span>
      )}
    </>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  hint,
  error,
  autoComplete,
}) {
  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <input
        id={id}
        className="ip-input"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
        style={IP.input}
      />
      <Feedback id={id} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  required = false,
  hint,
  error,
}) {
  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <select
        id={id}
        className="ip-input"
        value={value}
        required={required}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...IP.input, cursor: "pointer" }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Feedback id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({ id, label, value, onChange, placeholder, rows = 4, hint, error }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        className="ip-input"
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...IP.input, resize: "vertical", lineHeight: 1.6 }}
      />
      <Feedback id={id} hint={hint} error={error} />
    </div>
  );
}

/*
 * Color field. A bare <input type="color"> is invisible to anyone who cannot
 * use the OS picker, so it is paired with a text input carrying the same hex
 * value — either control drives the state, and the text one is keyboard and
 * screen-reader friendly.
 */
export function ColorField({ id, label, value, onChange, hint }) {
  const normalize = (raw) => {
    const trimmed = raw.trim();
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  };

  return (
    <div>
      <Label htmlFor={`${id}-hex`}>{label}</Label>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "stretch" }}>
        <input
          id={id}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} — color picker`}
          style={{
            width: 52,
            flexShrink: 0,
            padding: 3,
            border: "1px solid rgba(170,125,72,0.3)",
            borderRadius: 2,
            background: "#fff",
            cursor: "pointer",
          }}
        />
        <input
          id={`${id}-hex`}
          className="ip-input"
          type="text"
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(normalize(event.target.value))}
          placeholder="#1f3a5f"
          style={{ ...IP.input, fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}
        />
      </div>
      <Feedback id={id} hint={hint} />
    </div>
  );
}
