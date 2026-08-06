import { useState } from "react";
import { GLOBAL_CSS, PALETTE, S } from "../storefront/theme.js";

const FEATURES = [
  "Handles solid studio backdrops and mixed backgrounds alike",
  "Exports transparent PNGs ready to drop into your layout",
  "Works on 2 computers — desktop and laptop",
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
        <p style={S.eyebrow}>Pressmark Studio</p>
        <h1 style={S.h1}>BatchCutout</h1>
        <p style={S.lead}>
          Remove backgrounds from an entire folder of photos in Photoshop.
          Twenty-one portraits in about a minute, originals untouched.
        </p>

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
