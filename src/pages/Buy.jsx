import { useState } from "react";
import { GLOBAL_CSS, PALETTE, S } from "../storefront/theme.js";

/* The production pipeline, stated as a flow. BatchCutout is highlighted
   because the rest of the chain is Photoshop doing what it already does. */
const PIPELINE = [
  "1,000+ Images",
  "Pressmark BatchCutout",
  "Photoshop AI",
  "Background Removed",
  "Transparent PNGs",
  "Ready for Production",
];

/* Two clicks are the whole pitch: which folder to read, where to write. */
const STEPS = [
  ["1", "Choose the folder of images", "Point it at 10 or 10,000 — the folder is the unit of work."],
  ["2", "Choose where the cutouts go", "Originals stay untouched. Transparent PNGs land in your output folder."],
];

const FEATURES = [
  "AI-powered background removal inside Photoshop",
  "Process entire folders automatically",
  "Export transparent PNGs",
  "Originals remain untouched",
  "Built for 100s or 1,000+ images",
  "Works on 2 computers",
  "12 months of updates included",
];

export default function Buy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cancelled = new URLSearchParams(window.location.search).has("cancelled");

  const checkout = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      setError(body.error || "Could not start checkout. Please try again.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={S.shell}>
      <style>{GLOBAL_CSS}</style>
      <main style={S.card}>
        <p style={{ ...S.eyebrow, letterSpacing: "0.16em", lineHeight: 1.6 }}>
          AI Batch Background Removal for Photoshop
        </p>
        <h1 style={S.h1}>Pressmark BatchCutout</h1>

        <p style={S.lead}>
          Turn Photoshop's AI background removal into a high-volume production
          pipeline. Process entire folders of portraits and images instead of
          opening and removing backgrounds one file at a time.
        </p>

        {/* The volume claim earns its own rule — it is the whole reason this
            exists rather than a one-off action. */}
        <p
          style={{
            fontSize: "1.02rem",
            fontWeight: 600,
            lineHeight: 1.6,
            color: PALETTE.text,
            borderLeft: `3px solid ${PALETTE.accent}`,
            paddingLeft: "1rem",
            margin: "0 0 2rem",
          }}
        >
          Built for hundreds or 1,000+ images at a time.
        </p>

        <ol
          aria-label="Production pipeline"
          style={{
            listStyle: "none",
            margin: "0 0 2rem",
            padding: "1.75rem 1.25rem",
            background: PALETTE.text,
            textAlign: "center",
          }}
        >
          {PIPELINE.map((step, i) => (
            <li key={step}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  lineHeight: 1.4,
                  color: i === 1 ? PALETTE.accent : PALETTE.white,
                }}
              >
                {step}
              </span>
              {i < PIPELINE.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{ display: "block", color: PALETTE.accent, fontSize: "1rem", lineHeight: 1.7 }}
                >
                  ↓
                </span>
              )}
            </li>
          ))}
        </ol>

        {/* The whole workflow, stated as the two decisions the user actually makes. */}
        <ol style={{ listStyle: "none", margin: "0 0 2rem", padding: 0 }}>
          {STEPS.map(([num, title, detail]) => (
            <li
              key={num}
              style={{
                display: "flex",
                gap: "0.9rem",
                alignItems: "flex-start",
                padding: "1rem 0",
                borderTop: `1px solid ${PALETTE.border}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: "none",
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: PALETTE.accent,
                  color: PALETTE.black,
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {num}
              </span>
              <span>
                <span style={{ display: "block", fontSize: "0.98rem", fontWeight: 600, color: PALETTE.text }}>
                  {title}
                </span>
                <span style={{ display: "block", fontSize: "0.88rem", lineHeight: 1.6, color: PALETTE.textMuted, marginTop: "0.2rem" }}>
                  {detail}
                </span>
              </span>
            </li>
          ))}
        </ol>

        {/* The actual panel. Showing the real controls does more for trust than
            any amount of description — buyers can see exactly what they get. */}
        <figure style={{ margin: "0 0 2rem" }}>
          <img
            src="/batchcutout-panel.png"
            alt="The Pressmark BatchCutout panel in Photoshop, showing background-type options for mixed, solid-colour, and AI Remove Background modes, plus tolerance, output size, filename suffix, defringe, trim, subfolder, and overwrite settings"
            width={888}
            height={966}
            loading="lazy"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              border: `1px solid ${PALETTE.border}`,
            }}
          />
          <figcaption
            style={{
              fontSize: "0.82rem",
              lineHeight: 1.6,
              color: PALETTE.textMuted,
              marginTop: "0.75rem",
            }}
          >
            The BatchCutout panel. Choose how backgrounds are detected — including
            Photoshop&apos;s AI Remove Background for complex or mixed shots — then point
            it at a folder.
          </figcaption>
        </figure>

        <ul style={S.list}>
          {FEATURES.map((feature) => (
            <li key={feature} style={S.listItem}>
              <span style={S.tick} aria-hidden="true">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* Cancelled checkout returns here rather than to a dead-end page —
            the thing they were buying stays in front of them. */}
        {cancelled && (
          <div
            role="status"
            style={{
              marginBottom: "1.75rem",
              padding: "1rem 1.15rem",
              background: PALETTE.keyBg,
              border: `1px solid ${PALETTE.border}`,
              borderLeft: `3px solid ${PALETTE.accent}`,
            }}
          >
            <p style={{ fontSize: "0.92rem", fontWeight: 600, color: PALETTE.text, marginBottom: "0.35rem" }}>
              Checkout cancelled — you have not been charged.
            </p>
            <p style={{ fontSize: "0.88rem", lineHeight: 1.6, color: PALETTE.textMuted, margin: 0 }}>
              Nothing was saved and no payment was taken. Start again whenever you're
              ready, or email{" "}
              <a href="mailto:support@pressmark.studio">support@pressmark.studio</a>{" "}
              if something went wrong.
            </p>
          </div>
        )}

        <button className="pm-btn" style={S.btnPrimary} onClick={checkout} disabled={busy}>
          {busy ? "Opening checkout…" : "Buy BatchCutout"}
        </button>

        {error && <p role="alert" style={S.error}>{error}</p>}

        <p style={{ ...S.lead, fontSize: "0.88rem", margin: "1.75rem 0 0" }}>
          Already bought it? Email{" "}
          <a href="mailto:support@pressmark.studio">support@pressmark.studio</a>{" "}
          and we'll resend your key.
        </p>
        <p style={{ ...S.lead, fontSize: "0.88rem", margin: "0.5rem 0 0" }}>
          <a href="/" style={{ color: PALETTE.textMuted }}>← Pressmark Studio</a>
        </p>
      </main>
    </div>
  );
}
