import { useState } from "react";
import { GLOBAL_CSS, MONO_STACK, PALETTE, S } from "../storefront/theme.js";

const STATUS_COPY = {
  active: { label: "Active", color: PALETTE.accent },
  revoked: {
    label: "Revoked",
    color: PALETTE.danger,
    note: "This licence was refunded or disputed and can no longer be activated.",
  },
};

function formatDate(seconds) {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Portal() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [licenses, setLicenses] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const post = async (path, body, auth) => {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json().catch(() => ({})) };
  };

  const requestCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { response, body } = await post("/api/portal/request-code", { email });
      if (!response.ok) {
        setError(body.error || "We could not send a code just now.");
        return;
      }
      setNotice(body.message);
      setStep("code");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { response, body } = await post("/api/portal/verify-code", { email, code });
      if (!response.ok) {
        setError(body.error || "That code did not work.");
        return;
      }
      setToken(body.token);
      setLicenses(body.licenses || []);
      setNotice("");
      setStep("licenses");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const releaseDevice = async (key, deviceId, deviceName) => {
    if (!window.confirm(`Release ${deviceName}? You can activate it again later.`)) return;
    setBusy(true);
    setError("");
    try {
      const { response, body } = await post(
        "/api/portal/release-device",
        { key, device_id: deviceId },
        token
      );
      if (!response.ok) {
        setError(body.error || "We could not release that computer.");
        return;
      }
      setLicenses((current) => current.map((l) => (l.key === key ? body.license : l)));
      setNotice(`${deviceName} released.`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = {
    width: "100%",
    padding: "0.85rem 1rem",
    border: `1px solid ${PALETTE.border}`,
    background: PALETTE.white,
    color: PALETTE.text,
    fontSize: "0.95rem",
    fontFamily: "inherit",
    outline: "none",
    marginBottom: "1rem",
  };

  return (
    <div style={S.shell}>
      <style>{GLOBAL_CSS}</style>
      <main style={{ ...S.card, maxWidth: step === "licenses" ? 640 : 460 }}>
        <p style={S.eyebrow}>Pressmark Studio</p>
        <h1 style={S.h1}>Licence portal</h1>

        {step === "email" && (
          <>
            <p style={S.lead}>
              Enter the email address you used to buy BatchCutout and we'll send you a
              sign-in code.
            </p>
            <form onSubmit={requestCode}>
              <label htmlFor="portal-email" style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: "0.45rem" }}>
                Email address
              </label>
              <input
                id="portal-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
                style={field}
              />
              <button className="pm-btn" style={S.btnPrimary} disabled={busy}>
                {busy ? "Sending…" : "Send sign-in code"}
              </button>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <p style={S.lead}>{notice}</p>
            <form onSubmit={verifyCode}>
              <label htmlFor="portal-code" style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: "0.45rem" }}>
                Six-digit code
              </label>
              <input
                id="portal-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                style={{ ...field, fontFamily: MONO_STACK, fontSize: "1.3rem", letterSpacing: "0.3em", textAlign: "center" }}
              />
              <button className="pm-btn" style={S.btnPrimary} disabled={busy}>
                {busy ? "Checking…" : "Open my portal"}
              </button>
            </form>
            <p style={{ ...S.lead, fontSize: "0.85rem", margin: "1.25rem 0 0" }}>
              <button
                onClick={() => { setStep("email"); setCode(""); setError(""); }}
                style={{ background: "none", border: "none", padding: 0, color: PALETTE.accent, cursor: "pointer", font: "inherit", textDecoration: "underline" }}
              >
                Use a different email
              </button>
            </p>
          </>
        )}

        {step === "licenses" && (
          <>
            {licenses.length === 0 && (
              <p style={S.lead}>
                No licences are registered to {email}. If you bought with a different
                address, sign in with that one — or email{" "}
                <a href="mailto:support@pressmark.studio">support@pressmark.studio</a>.
              </p>
            )}

            {licenses.map((license) => {
              const status = STATUS_COPY[license.status] || STATUS_COPY.active;
              return (
                <section
                  key={license.key}
                  style={{ border: `1px solid ${PALETTE.border}`, borderTop: `4px solid ${status.color}`, marginBottom: "1.5rem" }}
                >
                  <div style={{ padding: "1.25rem", borderBottom: `1px solid ${PALETTE.border}` }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <code style={{ fontFamily: MONO_STACK, fontSize: "clamp(0.95rem, 4vw, 1.2rem)", fontWeight: 600, color: PALETTE.text, userSelect: "all", wordBreak: "break-all" }}>
                        {license.key}
                      </code>
                      <span style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: status.color, border: `1px solid ${status.color}`, padding: "0.25rem 0.6rem", whiteSpace: "nowrap" }}>
                        {status.label}
                      </span>
                    </div>
                    {status.note && (
                      <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: PALETTE.danger, margin: 0 }}>{status.note}</p>
                    )}
                  </div>

                  <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", padding: "1.25rem", margin: 0, borderBottom: `1px solid ${PALETTE.border}` }}>
                    {[
                      ["Version", license.version || "—"],
                      ["Purchased", formatDate(license.purchasedAt)],
                      ["Computers", `${license.activationCount} of ${license.maxDevices}`],
                      ["Updates until", license.updatesExpired ? `${formatDate(license.updatesUntil)} (expired)` : formatDate(license.updatesUntil)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.textMuted, marginBottom: "0.3rem" }}>{label}</dt>
                        <dd style={{ margin: 0, fontSize: "0.92rem", color: PALETTE.text }}>{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.textMuted, marginBottom: "0.75rem" }}>
                      Activated computers
                    </p>
                    {license.devices.length === 0 ? (
                      <p style={{ fontSize: "0.9rem", color: PALETTE.textMuted, margin: 0 }}>
                        Not activated on any computer yet.
                      </p>
                    ) : (
                      license.devices.map((device) => (
                        <div key={device.id} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 0", borderTop: `1px solid ${PALETTE.border}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.92rem", color: PALETTE.text }}>{device.name}</div>
                            <div style={{ fontFamily: MONO_STACK, fontSize: "0.75rem", color: PALETTE.textMuted }}>
                              {device.masked} · since {formatDate(device.activatedAt)}
                            </div>
                          </div>
                          <button
                            className="pm-copy"
                            onClick={() => releaseDevice(license.key, device.id, device.name)}
                            disabled={busy}
                            style={{ fontFamily: "inherit", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.45rem 0.9rem", border: `1px solid ${PALETTE.border}`, background: PALETTE.white, color: PALETTE.textMuted, cursor: "pointer" }}
                          >
                            Release
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              );
            })}

            {notice && <p style={{ ...S.note, marginBottom: "1rem" }}>{notice}</p>}
          </>
        )}

        {error && <p role="alert" style={S.error}>{error}</p>}

        <p style={{ ...S.lead, fontSize: "0.85rem", margin: "1.75rem 0 0" }}>
          <a href="/" style={{ color: PALETTE.textMuted }}>← Pressmark Studio</a>
        </p>
      </main>
    </div>
  );
}
