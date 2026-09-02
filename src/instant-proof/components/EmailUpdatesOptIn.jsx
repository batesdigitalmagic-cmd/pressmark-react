/*
 * "Get Pressmark publication tips" — the only route to a marketing subscription.
 *
 * ── The rules this enforces ──
 *
 *   • Nothing is prechecked. The control starts closed and the checkbox starts
 *     false.
 *   • The email field does not exist until the visitor has chosen to subscribe.
 *     There is no address sitting on screen to be hoovered up by a stray submit.
 *   • Generating a proof is not consent. Requesting a quote is not consent. The
 *     only email that can reach the subscription service is one typed here.
 *   • A quote email is never reused. This field starts blank even when the
 *     visitor has just sent a quote request.
 *
 * ── Honesty about the backend ──
 *
 * No subscription endpoint exists in this repository yet. The service reports
 * itself unconfigured and returns a plain explanation instead of a false
 * success — see services/subscriptionService.js. Nobody is told they were added
 * to a list that does not exist.
 */

import { useState } from "react";
import { getSubscriptionService } from "../services/subscriptionService.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function EmailUpdatesOptIn({ onSelected }) {
  const [chosen, setChosen] = useState(false); // never prechecked
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);

  const service = getSubscriptionService();

  const choose = (next) => {
    setChosen(next);
    setResult(null);
    if (next) onSelected?.();
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setResult(await service.subscribe(email, "instant-proof"));
    setSending(false);
  };

  return (
    <section
      aria-labelledby="email-updates-heading"
      style={{ border: `1px solid rgba(255,255,255,0.16)`, borderRadius: 4, padding: "1.1rem 1.2rem", display: "grid", gap: "0.8rem" }}
    >
      <label htmlFor="email-updates-choice" style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start", cursor: "pointer" }}>
        <input
          id="email-updates-choice"
          type="checkbox"
          checked={chosen}
          onChange={(event) => choose(event.target.checked)}
          style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, accentColor: PALETTE.accent, cursor: "pointer" }}
        />
        <span>
          <span
            id="email-updates-heading"
            style={{ display: "block", fontFamily: FONT_STACK, fontSize: "1.15rem", fontWeight: 800, color: PALETTE.white, lineHeight: 1.25 }}
          >
            Get Pressmark publication tips and automation updates.
          </span>
          <span style={{ display: "block", fontSize: "0.78rem", lineHeight: 1.55, color: PALETTE.textOnDarkMuted, marginTop: "0.25rem" }}>
            Optional. Nothing to do with your proof or a quote — tick this only if you want the
            emails.
          </span>
        </span>
      </label>

      {/* The field appears only once the visitor has asked for it. */}
      {chosen && (
        <form onSubmit={submit} style={{ display: "grid", gap: "0.7rem" }} noValidate>
          <div>
            <label htmlFor="subscribe-email" style={{ ...IP.label, color: PALETTE.accent }}>
              Email address
            </label>
            <input
              id="subscribe-email"
              className="ip-input ip-touch"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setResult(null);
              }}
              placeholder="you@organization.org"
              aria-describedby={result ? "subscribe-result" : undefined}
              style={IP.input}
            />
          </div>

          <button
            type="submit"
            className="ip-btn-primary ip-touch"
            style={{ ...IP.btnPrimary, justifySelf: "start" }}
            disabled={sending}
          >
            {sending ? "Subscribing…" : "Subscribe"}
          </button>

          {result && (
            <p
              id="subscribe-result"
              role="status"
              style={{
                margin: 0,
                fontSize: "0.83rem",
                lineHeight: 1.6,
                color: result.ok ? PALETTE.white : "#ffb4a8",
              }}
            >
              {result.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
