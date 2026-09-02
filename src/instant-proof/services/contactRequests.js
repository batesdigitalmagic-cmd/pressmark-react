/*
 * The two things a visitor can ask for that need a reply, and how those
 * requests reach the server.
 *
 * Kept out of the component so the copy and the transport can be tested and
 * reused without rendering anything.
 */

/** @typedef {'quote'|'review'} RequestKind */

export const REQUEST_KINDS = {
  quote: {
    id: "quote",
    heading: "Request your full-publication quote",
    lead: "Tell us where to send it. We will reply with a price for the complete publication, based on the proof you just generated.",
    submit: "Send my quote request",
    success: "Your quote request is on its way. We reply within one business day.",
  },
  review: {
    id: "review",
    heading: "Schedule a project review",
    lead: "A short call to walk through your publication, your timeline and what Pressmark would do with it.",
    submit: "Request a project review",
    success: "Thank you — we will email you some times within one business day.",
  },
};

/**
 * Build the payload for POST /api/quote.
 *
 * api/quote.js requires lastName, email and organization. Organization falls
 * back to the visitor's name, which is what that endpoint already does for the
 * CRM Company field — so we do not make someone type an organization they may
 * not have just to get a price.
 *
 * `marketingOptIn` travels as its own field. A future integration must read
 * that flag rather than infer consent from the presence of an email address.
 *
 * @param {{kind: RequestKind, name: string, email: string, notes: string, marketingOptIn: boolean}} form
 * @param {import('../models.js').ProofProject} project
 * @param {object} [config]  The publication configuration.
 * @param {object} [summary] Non-personal proof facts to carry forward.
 */
export function buildContactPayload(form, project, config, summary = {}) {
  const [firstName, ...rest] = String(form.name ?? "").trim().split(/\s+/);
  const lastName = rest.join(" ") || firstName || "";
  const organization = project?.organization?.organizationName?.trim() || form.name.trim();

  const details = [
    form.kind === "review"
      ? "Requested a project review after generating a Pressmark Instant Proof."
      : "Requested a full-publication quote after generating a Pressmark Instant Proof.",
    config?.label ? `Publication: ${config.label}.` : "",
    summary.templateName ? `Design: ${summary.templateName}.` : "",
    Number.isFinite(summary.photoCount) ? `Photographs supplied: ${summary.photoCount}.` : "",
    Number.isFinite(summary.recordCount) && summary.recordCount > 0
      ? `Records parsed: ${summary.recordCount}.`
      : "",
    project?.organization?.publicationSize ? `Trim size: ${project.organization.publicationSize}.` : "",
    project?.organization?.cityState ? `Location: ${project.organization.cityState}.` : "",
    form.notes ? `Notes: ${form.notes}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    firstName: rest.length > 0 ? firstName : "",
    lastName,
    email: form.email.trim(),
    organization,
    publicationType: config?.label ?? "",
    estimatedPageCount: project?.organization?.estimatedPageCount ?? "",
    deadline: project?.organization?.deadline ?? "",
    projectDetails: details,
    /* Explicit, separate, and never derived from the request itself. */
    marketingOptIn: Boolean(form.marketingOptIn),
    requestKind: form.kind,
    website: "", // honeypot, matching the marketing form
  };
}

/**
 * Send a contact request.
 *
 * Reuses the existing, already-deployed /api/quote endpoint rather than
 * inventing a second lead path. Credentials stay server-side; this only posts
 * JSON that the visitor typed.
 */
export async function sendContactRequest(payload) {
  const response = await fetch("/api/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "We could not send that. Please email quotes@pressmark.studio.");
  }
  return result;
}
