/*
 * The results view — mockup, production summary, and the quote CTA.
 *
 * Composition only. The mockup, the report and the CTA each own their own
 * presentation; this file decides the order they appear in and states, once
 * and prominently, that the sample is a demonstration whenever it is.
 */

import PublicationMockup from "./PublicationMockup.jsx";
import ProductionReport from "./ProductionReport.jsx";
import QuoteCTA from "./QuoteCTA.jsx";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

function expiryText(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "48 hours";
  return when.toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ProofResults({ project, config, result, onStartOver, summary, onCtaEvent }) {
  return (
    <div style={{ display: "grid", gap: "clamp(2rem, 5vw, 3.25rem)" }}>
      <header style={{ display: "grid", gap: "0.75rem" }}>
        <p style={IP.eyebrow}>Pressmark Instant Proof</p>
        <h1 style={{ ...IP.stepTitle, margin: 0 }}>
          {project.organization.organizationName || "Your publication"}, as Pressmark would build it.
        </h1>
        <p style={{ ...IP.stepLead, margin: 0 }}>
          A cover and two interior spreads, set in your colors and built from the content you
          supplied. Every page carries the Pressmark credit in its footer.
        </p>
      </header>

      {result.simulated && (
        <p style={{ ...IP.notice, borderLeftColor: PALETTE.ink }}>
          <strong style={{ color: PALETTE.text }}>This is a demonstration sample.</strong> The pages
          below were composed in your browser to show Pressmark's layout system, hierarchy and
          color handling — they are not an Adobe InDesign render. The file counts, record counts and
          image-resolution findings in the summary are measured from your actual files. When you
          engage Pressmark, your publication is produced through our full InDesign production
          pipeline.
        </p>
      )}

      <PublicationMockup project={project} config={config} result={result} />

      <ProductionReport result={result} />

      <QuoteCTA
        project={project}
        config={config}
        summary={summary}
        onStartOver={onStartOver}
        onEvent={onCtaEvent}
      />

      <p style={{ fontFamily: FONT_STACK, fontSize: "0.95rem", lineHeight: 1.7, color: PALETTE.textMuted, margin: 0 }}>
        Your sample is private and automatically removed after 48 hours — by{" "}
        {expiryText(result.expiresAt)}. In this prototype nothing was uploaded at all: your files
        stayed in this browser tab and are gone the moment you close it.
      </p>
    </div>
  );
}
