import { useEffect, useRef, useState } from "react";
import { trackPurchase } from "../analytics.js";
import { GLOBAL_CSS, MONO_STACK, PALETTE, S } from "../storefront/theme.js";

const DOWNLOAD_URL = import.meta.env.VITE_DOWNLOAD_URL || "/api/download";
const MAX_ATTEMPTS = 5;
const RETRY_MS = 1500;

export default function Success() {
  const sessionId = new URLSearchParams(window.location.search).get("session_id");

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const attempts = useRef(0);
  // StrictMode double-invokes effects; a purchase must fire once.
  const firedPurchase = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let timer;

    const load = async () => {
      try {
        const response = await fetch("/api/license/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (cancelled) return;

        if (response.ok) {
          const payload = await response.json();
          setData(payload);
          /* Only the commercial fields go to GA4. The licence key and email
             sitting alongside them in `payload` are never passed on. */
          if (payload.order && !firedPurchase.current) {
            firedPurchase.current = true;
            trackPurchase(payload.order);
          }
          return;
        }

        /* Stripe occasionally still reports a session as unpaid for a beat
           after redirect. Retry before surfacing anything alarming — seconds
           after someone paid is the worst possible moment to be wrong. */
        if (response.status === 402 && attempts.current < MAX_ATTEMPTS) {
          attempts.current += 1;
          timer = setTimeout(load, RETRY_MS);
          return;
        }

        const body = await response.json().catch(() => ({}));
        setError(body.error || "We could not retrieve your license just now.");
      } catch {
        if (cancelled) return;
        if (attempts.current < MAX_ATTEMPTS) {
          attempts.current += 1;
          timer = setTimeout(load, RETRY_MS);
          return;
        }
        setError("We could not reach the server to load your license.");
      }
    };

    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  const copyKey = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — the key is visible and selectable anyway */
    }
  };

  const shell = (children) => (
    <div style={S.shell}>
      <style>{GLOBAL_CSS}</style>
      <main style={S.card}>{children}</main>
    </div>
  );

  if (!sessionId) {
    return shell(
      <>
        <h1 style={S.h1}>No order found</h1>
        <p style={S.lead}>
          This page needs an order to show. If you just bought BatchCutout, your key
          is in your email. If it isn't there, email{" "}
          <a href="mailto:support@pressmark.studio">support@pressmark.studio</a> and
          we'll resend it.
        </p>
      </>
    );
  }

  if (error) {
    /* Reassure first. Their money is fine and the license exists — the only
       thing that failed is this page reading it back. */
    return shell(
      <>
        <p style={S.eyebrow}>Payment complete</p>
        <h1 style={S.h1}>Your payment went through</h1>
        <p style={S.lead}>
          {error} Your license was created either way — it's on its way to your
          email. If it hasn't arrived in a few minutes, email{" "}
          <a href="mailto:support@pressmark.studio">support@pressmark.studio</a>{" "}
          with the address you paid with and we'll send it straight over.
        </p>
        <a className="pm-btn" style={S.btnPrimary} href={DOWNLOAD_URL}>
          Download BatchCutout
        </a>
        <p style={{ ...S.note, marginTop: "1.5rem" }}>
          The download works now — you can install while you wait for the key.
        </p>
      </>
    );
  }

  if (!data) {
    return shell(
      <>
        <p style={S.eyebrow}>Payment complete</p>
        <h1 style={S.h1}>Setting up your license…</h1>
        <p style={S.lead}>This takes a second.</p>
        <div
          className="pm-skeleton"
          aria-hidden="true"
          style={{
            height: 108,
            background: PALETTE.keyBg,
            border: `1px solid ${PALETTE.border}`,
            animation: "pm-pulse 1.4s ease-in-out infinite",
          }}
        />
      </>
    );
  }

  return shell(
    <>
      <p style={S.eyebrow}>Payment complete</p>
      <h1 style={S.h1}>You're all set</h1>
      <p style={S.lead}>
        {data.email ? (
          <>A copy of this is on its way to <strong style={{ color: PALETTE.text }}>{data.email}</strong>.</>
        ) : (
          "Save this key somewhere safe."
        )}
      </p>

      {/* The thing they came for. */}
      <div
        style={{
          position: "relative",
          background: PALETTE.keyBg,
          border: `1px solid ${PALETTE.border}`,
          borderTop: `4px solid ${PALETTE.accent}`,
          padding: "1.75rem 1.25rem 1.5rem",
          textAlign: "center",
          marginBottom: "1.75rem",
        }}
      >
        <span
          style={{
            display: "block",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: PALETTE.textMuted,
            marginBottom: "0.85rem",
          }}
        >
          Your license key
        </span>
        <code
          style={{
            display: "block",
            fontFamily: MONO_STACK,
            fontSize: "clamp(1.05rem, 5vw, 1.6rem)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: PALETTE.text,
            userSelect: "all",
            wordBreak: "break-all",
            lineHeight: 1.4,
          }}
        >
          {data.key}
        </code>
        <button
          className="pm-copy"
          onClick={copyKey}
          style={{
            marginTop: "1rem",
            fontFamily: "inherit",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0.5rem 1.1rem",
            border: `1px solid ${PALETTE.border}`,
            background: PALETTE.white,
            color: PALETTE.textMuted,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {copied ? "Copied" : "Copy key"}
        </button>
      </div>

      <a className="pm-btn" style={S.btnPrimary} href={DOWNLOAD_URL}>
        Download BatchCutout
      </a>

      <ol
        style={{
          margin: "2rem 0 1.75rem",
          paddingLeft: "1.25rem",
          fontSize: "0.95rem",
          lineHeight: 1.7,
          color: PALETTE.textMuted,
        }}
      >
        <li style={{ marginBottom: "0.6rem" }}>Quit Photoshop.</li>
        <li style={{ marginBottom: "0.6rem" }}>
          Unzip, and copy <strong style={{ color: PALETTE.text }}>BatchCutout.jsxbin</strong> into
          your Photoshop <strong style={{ color: PALETTE.text }}>Presets/Scripts</strong> folder.
        </li>
        <li style={{ marginBottom: "0.6rem" }}>
          Start Photoshop, then go to{" "}
          <strong style={{ color: PALETTE.text }}>File › Scripts › BatchCutout</strong>.
        </li>
        <li>Paste the key above when it asks.</li>
      </ol>

      <p style={S.note}>
        Your key works on <strong style={{ color: PALETTE.text }}>{data.maxDevices} computers</strong> —
        a desktop and a laptop, for example. Replacing a machine? Email{" "}
        <a href="mailto:support@pressmark.studio">support@pressmark.studio</a> and
        we'll free up the old one.
      </p>
    </>
  );
}
