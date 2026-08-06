import { useEffect, useState } from "react";
import { GLOBAL_CSS, MONO_STACK, PALETTE, S } from "../storefront/theme.js";

/*
 * Renders /api/health. Shows only whether each variable is present — the API
 * never returns a value, so there is nothing here to leak.
 */
export default function Health() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then(setData)
      .catch(() => setError("Could not reach /api/health."));
  }, []);

  const row = (name, present) => (
    <div
      key={name}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        padding: "0.55rem 0",
        borderTop: `1px solid ${PALETTE.border}`,
      }}
    >
      <code style={{ fontFamily: MONO_STACK, fontSize: "0.8rem", color: PALETTE.text, wordBreak: "break-all" }}>
        {name}
      </code>
      <span
        style={{
          flexShrink: 0,
          fontSize: "0.65rem",
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: present ? PALETTE.accent : PALETTE.textMuted,
        }}
      >
        {present ? "Set" : "Not set"}
      </span>
    </div>
  );

  return (
    <div style={S.shell}>
      <style>{GLOBAL_CSS}</style>
      <main style={{ ...S.card, maxWidth: 620 }}>
        <p style={S.eyebrow}>Pressmark Studio</p>
        <h1 style={S.h1}>Configuration</h1>

        {error && <p role="alert" style={S.error}>{error}</p>}
        {!data && !error && <p style={S.lead}>Checking…</p>}

        {data && (
          <>
            <p
              style={{
                ...S.note,
                marginBottom: "1.75rem",
                borderLeftColor: data.ok ? PALETTE.accent : PALETTE.danger,
              }}
            >
              {data.ok
                ? "Every required variable is present."
                : `Missing: ${data.missingRequired.join(", ")}`}
            </p>

            {Object.entries(data.groups).map(([id, group]) => (
              <section key={id} style={{ marginBottom: "1.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", marginBottom: "0.5rem" }}>
                  <h2 style={{ fontFamily: "inherit", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: PALETTE.text }}>
                    {group.label}
                  </h2>
                  <span style={{ flexShrink: 0, fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: group.ready ? PALETTE.accent : PALETTE.danger }}>
                    {group.ready ? "Ready" : "Incomplete"}
                  </span>
                </div>
                {group.backend && (
                  <p style={{ fontSize: "0.78rem", color: PALETTE.textMuted, marginBottom: "0.4rem" }}>
                    Backend: {group.backend}
                  </p>
                )}
                {Object.entries(group.variables).map(([name, present]) => row(name, present))}
              </section>
            ))}

            <p style={{ fontSize: "0.75rem", color: PALETTE.textMuted, margin: 0 }}>
              {data.note}
            </p>
          </>
        )}

        <p style={{ ...S.lead, fontSize: "0.85rem", margin: "1.75rem 0 0" }}>
          <a href="/" style={{ color: PALETTE.textMuted }}>← Pressmark Studio</a>
        </p>
      </main>
    </div>
  );
}
