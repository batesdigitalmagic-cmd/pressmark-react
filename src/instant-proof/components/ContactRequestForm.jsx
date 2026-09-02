/*
 * The one place Instant Proof asks for an email address.
 *
 * Shown only when a visitor asks for something that needs a reply — a
 * full-publication quote, or a project review. Generating a proof never reaches
 * this form.
 *
 * ── What is required, and why ──
 *
 *   email   Required. There is no way to answer without it.
 *   name    Required. api/quote.js validates Last_Name for the CRM lead.
 *
 * Everything else is carried forward from the proof the visitor just made, so
 * they are not asked twice. Organization falls back to their name, matching
 * what api/quote.js already does with Company.
 *
 * ── Marketing consent ──
 *
 * The opt-in below is UNCHECKED and separate. Requesting a quote is a
 * transactional act; it is not permission to market to someone. The checkbox
 * state travels to the server as its own field so a future integration cannot
 * mistake a quote for a subscription.
 */

import { useState } from "react";
import { isValidEmail } from "../services/subscriptionService.js";
import { REQUEST_KINDS } from "../services/contactRequests.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function ContactRequestForm({ kind, project, config, onClose, onSubmit }) {
  const copy = REQUEST_KINDS[kind] ?? REQUEST_KINDS.quote;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [optIn, setOptIn] = useState(false); // never prechecked
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle");
  const [failure, setFailure] = useState("");

  const submit = async (event) => {
    event.preventDefault();

    const found = {};
    if (!name.trim()) found.name = "Please tell us your name.";
    if (!email.trim()) found.email = "An email address is required so we can reply.";
    else if (!isValidEmail(email)) found.email = "Enter a valid email address.";

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setState("sending");
    setFailure("");
    try {
      await onSubmit({
        kind: copy.id,
        name: name.trim(),
        email: email.trim(),
        notes: notes.trim(),
        /* Separate, affirmative, and never assumed from this request. */
        marketingOptIn: optIn,
      });
      setState("sent");
    } catch (error) {
      setState("idle");
      setFailure(error?.message || "We could not send that. Please email quotes@pressmark.studio.");
    }
  };

  if (state === "sent") {
    return (
      <div style={{ ...IP.card, display: "grid", gap: "0.9rem" }}>
        <h3 style={{ fontFamily: FONT_STACK, fontSize: "1.5rem", fontWeight: 900, margin: 0, color: PALETTE.text }}>
          {copy.success}
        </h3>
        {optIn && (
          <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: PALETTE.textMuted, margin: 0 }}>
            You also asked for Pressmark publication tips. We will confirm that separately.
          </p>
        )}
        <button type="button" className="ip-btn-ghost ip-touch" style={{ ...IP.btnGhost, justifySelf: "start" }} onClick={onClose}>
          Back to my proof
        </button>
      </div>
    );
  }

  const field = (id, label, value, setValue, props = {}) => (
    <div>
      <label htmlFor={id} style={IP.label}>
        {label}
        {props.required && <span style={{ color: "#b3261e" }} aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        className="ip-input ip-touch"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={errors[id] ? "true" : undefined}
        aria-describedby={errors[id] ? `${id}-error` : undefined}
        style={IP.input}
        {...props}
      />
      {errors[id] && (
        <span id={`${id}-error`} role="alert" style={IP.error}>{errors[id]}</span>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} style={{ ...IP.card, display: "grid", gap: "1.15rem" }} noValidate>
      <div>
        <h3 style={{ fontFamily: FONT_STACK, fontSize: "1.55rem", fontWeight: 900, margin: "0 0 0.4rem", color: PALETTE.text }}>
          {copy.heading}
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: PALETTE.textMuted, margin: 0 }}>{copy.lead}</p>
      </div>

      {/* What is already known, so nobody retypes it. */}
      <p style={{ ...IP.notice, margin: 0 }}>
        We will include your proof details automatically: {config?.label ?? "publication"}
        {project?.organization?.organizationName ? ` for ${project.organization.organizationName}` : ""}
        {project?.assets?.length ? `, ${project.assets.length} file${project.assets.length === 1 ? "" : "s"}` : ""}.
      </p>

      <div style={IP.grid2}>
        {field("name", "Your name", name, setName, { required: true, autoComplete: "name", type: "text" })}
        {field("email", "Email address", email, setEmail, { required: true, autoComplete: "email", type: "email", inputMode: "email" })}
      </div>

      <div>
        <label htmlFor="notes" style={IP.label}>Anything else we should know</label>
        <textarea
          id="notes"
          className="ip-input"
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional"
          style={{ ...IP.input, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

      {/* Unchecked. A quote is not consent to be marketed to. */}
      <label
        htmlFor="marketing-opt-in"
        style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", padding: "0.85rem", border: `1px solid ${PALETTE.hairline}`, borderRadius: 3, cursor: "pointer" }}
      >
        <input
          id="marketing-opt-in"
          type="checkbox"
          checked={optIn}
          onChange={(event) => setOptIn(event.target.checked)}
          style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0, accentColor: PALETTE.accent, cursor: "pointer" }}
        />
        <span style={{ fontSize: "0.85rem", lineHeight: 1.6, color: PALETTE.text }}>
          Also send me Pressmark publication tips and automation updates.
          <span style={{ display: "block", color: PALETTE.textMuted, fontSize: "0.78rem", marginTop: "0.2rem" }}>
            Optional, and separate from this request. Leave it unticked and we will only use your
            address to reply.
          </span>
        </span>
      </label>

      {failure && (
        <div role="alert" style={{ ...IP.notice, borderLeftColor: "#b3261e", margin: 0 }}>{failure}</div>
      )}

      <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
        <button type="submit" className="ip-btn-primary ip-touch" style={IP.btnPrimary} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : copy.submit}
        </button>
        <button type="button" className="ip-btn-ghost ip-touch" style={IP.btnGhost} onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
