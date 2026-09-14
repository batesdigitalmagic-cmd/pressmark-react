/*
 * /contact — the custom publication request.
 *
 * ── Same endpoint, new form ──
 *
 * This posts the exact JSON contract api/quote.js already accepts: the same
 * field names, the same honeypot, the same optional upload link in the
 * response. Only the markup is new. Changing the payload would mean changing
 * the Zoho lead mapping behind it, which is not what a redesign is for.
 *
 * ── The upload link ──
 *
 * Customer files never pass through our server. api/quote.js creates a scoped
 * Zoho WorkDrive folder and returns an upload link, and the browser is handed
 * that link to use directly — which is why a 40 MB InDesign package does not
 * hit a serverless body limit.
 */

import { useState } from "react";

import AppShell from "../instant-proof/components/AppShell.jsx";
import { BUDGET_RANGES, PUBLICATION_TYPES } from "../instant-proof/business.js";

const EMPTY = {
  /* One name field. The server splits it for the CRM, which wants a last name. */
  name: "",
  email: "",
  phone: "",
  organization: "",
  publicationType: "",
  estimatedPageCount: "",
  deadline: "",
  budgetRange: "",
  projectDetails: "",
  website: "", // honeypot — left blank by real visitors
};

function Field({ label, name, value, onChange, type = "text", required = false, children }) {
  const id = `quote-${name}`;
  return (
    <p className="ip-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children ?? (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          required={required}
          onChange={(event) => onChange(name, event.target.value)}
        />
      )}
    </p>
  );
}

export default function Contact() {
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [failure, setFailure] = useState("");

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setFailure("");
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Price request failed");
      setUploadUrl(result.uploadUrl || "");
      setSent(true);
      setForm(EMPTY);
    } catch (error) {
      setFailure(
        error.message || "Something went wrong. Please email quotes@pressmark.studio directly."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell current="/contact">
      <p className="ip-crumb">Custom publications</p>
      <h1 className="ip-h1">Tell us what you are making</h1>
      <p className="ip-lead">
        Yearbooks, annual reports, association directories, event programs — anything the
        directory tool does not cover. We answer with a real price, not a brochure.
      </p>

      {sent ? (
        <div className="ip-card" style={{ marginTop: "var(--proof-space-6)" }}>
          <h2 className="ip-card-title">Thank you — your request is in.</h2>
          <p className="ip-note" style={{ marginTop: "var(--proof-space-3)" }}>
            We reply by email, usually within one business day.
          </p>
          {uploadUrl && (
            <p style={{ marginTop: "var(--proof-space-4)" }}>
              <a className="ip-btn ip-btn-primary ip-touch" href={uploadUrl} target="_blank" rel="noreferrer">
                Upload your files
              </a>
              <span className="ip-note ip-muted" style={{ display: "block", marginTop: "var(--proof-space-2)" }}>
                A private folder created for this project. Photos, spreadsheets and existing
                InDesign packages are all welcome.
              </span>
            </p>
          )}
        </div>
      ) : (
        <form className="ip-card" onSubmit={submit} style={{ marginTop: "var(--proof-space-6)" }}>
          <div className="ip-field-grid">
            <Field label="Name" name="name" value={form.name} onChange={set} required />
            <Field label="Email" name="email" type="email" value={form.email} onChange={set} required />
            <Field label="Phone" name="phone" type="tel" value={form.phone} onChange={set} />
            <Field label="Organization" name="organization" value={form.organization} onChange={set} />
            <Field label="Publication type" name="publicationType" value={form.publicationType} onChange={set}>
              <select
                id="quote-publicationType"
                name="publicationType"
                value={form.publicationType}
                onChange={(event) => set("publicationType", event.target.value)}
              >
                <option value="">Select one</option>
                {PUBLICATION_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Estimated pages"
              name="estimatedPageCount"
              type="number"
              value={form.estimatedPageCount}
              onChange={set}
            />
            <Field label="Deadline" name="deadline" type="date" value={form.deadline} onChange={set} />
            <Field label="Budget range" name="budgetRange" value={form.budgetRange} onChange={set}>
              <select
                id="quote-budgetRange"
                name="budgetRange"
                value={form.budgetRange}
                onChange={(event) => set("budgetRange", event.target.value)}
              >
                <option value="">Select one</option>
                {BUDGET_RANGES.map((range) => (
                  <option key={range}>{range}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Project details" name="projectDetails" value={form.projectDetails} onChange={set}>
            <textarea
              id="quote-projectDetails"
              name="projectDetails"
              rows={5}
              value={form.projectDetails}
              onChange={(event) => set("projectDetails", event.target.value)}
              placeholder="What are you making, who is it for, and where are you in the process?"
            />
          </Field>

          {/*
            * Honeypot. Hidden from people, irresistible to the bots that fill
            * every field they find; api/quote.js drops any submission that
            * carries a value here.
            */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={(event) => set("website", event.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="ip-honeypot"
          />

          {failure && (
            <p role="alert" className="ip-error" style={{ marginTop: "var(--proof-space-3)" }}>
              {failure}
            </p>
          )}

          <p style={{ marginTop: "var(--proof-space-5)", marginBottom: 0 }}>
            <button type="submit" className="ip-btn ip-btn-gold ip-touch" disabled={sending}>
              {sending ? "Sending…" : "Request a price"}
            </button>
          </p>
        </form>
      )}

      <section className="ip-prose" style={{ marginTop: "var(--proof-space-6)" }}>
        <p className="ip-note ip-muted">
          Prefer email? <a href="mailto:quotes@pressmark.studio">quotes@pressmark.studio</a>.
        </p>
      </section>
    </AppShell>
  );
}
