/*
 * The results-page call to action.
 *
 * Three separate, independent actions. They are separate because they mean
 * different things and carry different consent:
 *
 *   1. Request a quote      — needs an email so we can reply.
 *   2. Schedule a review    — needs an email so we can offer times.
 *   3. Email updates        — needs an email AND a deliberate opt-in.
 *
 * Nothing here subscribes anybody. The first two open a focused form whose
 * marketing checkbox starts unticked; the third is its own control with its own
 * email field that does not exist until it is asked for.
 *
 * A visitor who wants none of these keeps their proof and owes us nothing.
 */

import { useState } from "react";
import ContactRequestForm from "./ContactRequestForm.jsx";
import EmailUpdatesOptIn from "./EmailUpdatesOptIn.jsx";
import { buildContactPayload, sendContactRequest } from "../services/contactRequests.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function QuoteCTA({ project, config, summary, onStartOver, onEvent }) {
  const [request, setRequest] = useState(null);

  const open = (kind) => {
    setRequest(kind);
    onEvent?.(kind);
  };

  const submit = async (form) => {
    await sendContactRequest(buildContactPayload(form, project, config, summary));
  };

  return (
    <section
      aria-labelledby="proof-cta-heading"
      style={{
        background: PALETTE.ink,
        color: PALETTE.white,
        borderRadius: 4,
        padding: "clamp(1.5rem, 5vw, 3rem)",
        display: "grid",
        gap: "1.25rem",
      }}
    >
      <h2
        id="proof-cta-heading"
        style={{ fontFamily: FONT_STACK, fontSize: "clamp(1.7rem, 4.5vw, 2.8rem)", fontWeight: 900, lineHeight: 1.1, margin: 0 }}
      >
        Your Pressmark proof is ready.
      </h2>

      <p style={{ fontSize: "1rem", lineHeight: 1.75, color: PALETTE.textOnDark, margin: 0, maxWidth: 620 }}>
        This sample demonstrates what Pressmark's publication automation can do with your content.
        Let Pressmark transform the complete project into a professionally designed,
        production-ready publication.
      </p>

      {request ? (
        <ContactRequestForm
          kind={request}
          project={project}
          config={config}
          onClose={() => setRequest(null)}
          onSubmit={submit}
        />
      ) : (
        <>
          <div className="ip-result-actions" style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", marginTop: "0.25rem" }}>
            <button type="button" className="ip-btn-primary ip-touch" style={IP.btnPrimary} onClick={() => open("quote")}>
              Request My Full-Publication Quote
            </button>
            <button
              type="button"
              className="ip-btn-ghost ip-touch"
              style={{ ...IP.btnGhost, color: PALETTE.white, borderColor: "rgba(255,255,255,0.35)" }}
              onClick={() => open("review")}
            >
              Schedule a Project Review
            </button>
            <button
              type="button"
              className="ip-btn-ghost ip-touch"
              style={{ ...IP.btnGhost, color: PALETTE.white, borderColor: "rgba(255,255,255,0.2)" }}
              onClick={onStartOver}
            >
              Start Another Proof
            </button>
          </div>

          <EmailUpdatesOptIn onSelected={() => onEvent?.("updates")} />

          <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: PALETTE.textOnDarkMuted, margin: 0 }}>
            We ask for an email only when you want a reply. Generating a proof does not add you to
            any list, and a quote request will not either unless you tick the box yourself.
          </p>
        </>
      )}
    </section>
  );
}
