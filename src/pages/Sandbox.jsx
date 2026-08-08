import { useState } from "react";
import { GLOBAL_CSS, MONO_STACK, PALETTE, S } from "../storefront/theme.js";

/*
 * Sandbox checkout. Posts only to /api/checkout-test, which cannot reach live
 * credentials. Visually unmistakable so nobody confuses it with /buy.
 */
export default function Sandbox() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cancelled = new URLSearchParams(window.location.search).has("cancelled");

  const checkout = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout-test", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (body.url) {
        window.location.assign(body.url);
        return;
      }
      setError(body.error || "Could not start sandbox checkout.");
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
        <div
          style={{
            border: `2px dashed ${PALETTE.accent}`,
            background: PALETTE.keyBg,
            padding: "0.85rem 1.1rem",
            marginBottom: "1.75rem",
            fontSize: "0.72rem",
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: PALETTE.accent,
            textAlign: "center",
          }}
        >
          Sandbox — no real payment
        </div>

        <p style={S.eyebrow}>Pressmark Studio</p>
        <h1 style={S.h1}>BatchCutout (test)</h1>
        <p style={S.lead}>
          This page uses Stripe test credentials. No card is charged and no money
          moves. It exists to verify checkout, licence issuance, and refunds end to
          end before going live.
        </p>

        <div style={{ ...S.note, marginBottom: "1.75rem" }}>
          <strong style={{ color: PALETTE.text }}>Test card</strong>
          <div style={{ fontFamily: MONO_STACK, fontSize: "0.95rem", color: PALETTE.text, margin: "0.5rem 0 0.35rem" }}>
            4242 4242 4242 4242
          </div>
          Any future expiry, any CVC, any postcode.
        </div>

        {cancelled && (
          <div
            role="status"
            style={{
              marginBottom: "1.75rem",
              padding: "1rem 1.15rem",
              background: PALETTE.keyBg,
              border: `1px solid ${PALETTE.border}`,
              borderLeft: `3px solid ${PALETTE.accent}`,
              fontSize: "0.88rem",
              lineHeight: 1.6,
              color: PALETTE.textMuted,
            }}
          >
            Sandbox checkout cancelled. Nothing was charged — nothing ever is here.
          </div>
        )}

        <button className="pm-btn" style={S.btnPrimary} onClick={checkout} disabled={busy}>
          {busy ? "Opening sandbox checkout…" : "Run a sandbox purchase"}
        </button>

        {error && <p role="alert" style={S.error}>{error}</p>}

        <p style={{ ...S.lead, fontSize: "0.85rem", margin: "1.75rem 0 0" }}>
          The real product page is <a href="/buy">/buy</a>.
        </p>
      </main>
    </div>
  );
}
