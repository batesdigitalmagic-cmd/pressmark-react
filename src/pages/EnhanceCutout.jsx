import { useState } from "react";
import { PALETTE } from "../storefront/theme.js";
import "./Buy.css";

/* ─────────────────────────────────────────────
   CONFIG — Pressmark Enhance + Cutout

   Display copy only. The amount charged comes from the Stripe price on the
   server (lib/products.js → STRIPE_PRICE_ID_ENHANCECUTOUT). Keep them in step.
───────────────────────────────────────────── */

const PRODUCT_ID = "enhancecutout";
const VERSION = "1.0.0";
const PRICE = "$19.99";
const TRIAL_PHOTOS = 10;

/* The trial is enforced inside the script (10 photos), so "try free" is
   simply the download — same model as BatchCutout. */
const TRIAL_URL = "/api/download?product=enhancecutout";

const PENGUIN_SRC = "/pressmark-penguin.svg";

const NAV = [
  { label: "Overview", href: "#overview" },
  { label: "How it works", href: "#how" },
  { label: "Costs", href: "#costs" },
  { label: "Pricing", href: "#pricing" },
];

const FEATURES = [
  "Enhances and cuts out an entire folder in one run",
  "Never opens your photos one by one",
  "Transparent PNGs out, originals never changed",
  "Natural contrast and clean color on every photo",
  "Optional AI regenerate for detail and smooth skin",
];

const STEPS = [
  {
    title: "Noise reduced",
    body: "Grain and compression blotches are cleaned up first, so every later step starts from a clean image.",
  },
  {
    title: "Small photos enlarged",
    body: "Low-resolution photos are upscaled with Super Zoom, which runs on your own computer.",
  },
  {
    title: "Premium AI regenerate (optional)",
    body: "Photoshop's generative AI rebuilds fine detail and smooths skin while keeping each person looking like themselves.",
  },
  {
    title: "Natural contrast",
    body: "A gentle, photo-aware contrast pass. No crushed blacks, blown highlights or HDR look, and skin tones stay put.",
  },
  {
    title: "Subject cut out",
    body: "Select Subject masks every photo and saves it as a transparent PNG, trimmed to the subject.",
  },
];

const INCLUDED = [
  "Pressmark Enhance + Cutout script",
  "Pressmark AI action set (installs itself)",
  "Use on 2 computers",
  "Version 1.x updates",
  `${TRIAL_PHOTOS}-photo free trial`,
];

function Tick() {
  return (
    <span className="bc-tick" aria-hidden="true">
      ✓
    </span>
  );
}

export default function EnhanceCutout() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [penguinOk, setPenguinOk] = useState(true);

  const cancelled = new URLSearchParams(window.location.search).has("cancelled");

  const checkout = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: PRODUCT_ID }),
      });
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

  const trialButton = (
    <span className="bc-cta">
      <a className="bc-btn" href={TRIAL_URL}>
        Download Free Trial
      </a>
      <span className="bc-btn-note">{TRIAL_PHOTOS} photos free · no card required</span>
    </span>
  );

  const buyButton = (
    <span className="bc-cta">
      <button type="button" className="bc-btn" onClick={checkout} disabled={busy}>
        {busy ? "Opening checkout…" : "Buy Enhance + Cutout"}
      </button>
      <span className="bc-btn-note">One-time purchase · instant download · {PRICE}</span>
    </span>
  );

  const tokens = {
    "--bc-accent": PALETTE.accent,
    "--bc-accent-dark": PALETTE.accentDeep,
    "--bc-ink": PALETTE.text,
    "--bc-muted": PALETTE.textMuted,
    "--bc-cream": PALETTE.keyBg,
    "--bc-border": PALETTE.border,
    "--bc-danger": PALETTE.danger,
  };

  return (
    <div className="bc-page" style={tokens}>
      <header className="bc-header">
        <div className="bc-shell bc-header-inner">
          <a className="bc-product-brand" href="#overview">
            <img src={PENGUIN_SRC} alt="" width={42} height={42} />
            Pressmark Enhance + Cutout
          </a>
          <nav aria-label="Primary">
            <ul className="bc-nav">
              {NAV.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section className="bc-hero" id="overview">
          <div className="bc-shell">
            <div className="bc-hero-copy">
              <h1 className="bc-h1">
                Fix Bad Photos and Cut Them Out — a Whole Folder at Once.
              </h1>
              <p className="bc-lead">
                Pressmark Enhance + Cutout is a Photoshop script that cleans up noisy,
                soft or dull photos and cuts every subject out to a transparent PNG, in
                one unattended run. Point it at a folder of 100 photos and come back to
                100 finished cutouts.
              </p>

              <ul className="bc-feature-list">
                {FEATURES.map((feature) => (
                  <li key={feature}>
                    <Tick />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {cancelled && (
                <div role="status" className="bc-notice">
                  <p className="bc-notice-title">
                    Checkout cancelled — you have not been charged.
                  </p>
                  <p className="bc-small">
                    Nothing was saved and no payment was taken. Start again whenever
                    you&apos;re ready, or email{" "}
                    <a href="mailto:support@pressmark.studio">support@pressmark.studio</a>.
                  </p>
                </div>
              )}

              <div className="bc-cta-row">
                {trialButton}
                {buyButton}
              </div>

              {error && (
                <p role="alert" className="bc-error">
                  {error}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="bc-section bc-section-dark" id="how">
          <div className="bc-shell">
            <div className="bc-section-head">
              <p className="bc-eyebrow">What happens to each photo</p>
              <h2 className="bc-h2">Five steps, every photo, no clicking.</h2>
              <p className="bc-lead">
                Choose a folder (or a job folder with an <code>in</code> folder inside)
                and the script works through every image. A log lists what was done to
                each one, and anything worth a second look is flagged.
              </p>
            </div>

            <ol
              style={{
                listStyle: "none",
                margin: "2rem 0 0",
                padding: 0,
                display: "grid",
                gap: "1.25rem",
                maxWidth: "46rem",
              }}
            >
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  style={{ display: "flex", gap: "1rem", alignItems: "baseline" }}
                >
                  <span
                    aria-hidden="true"
                    style={{ color: PALETTE.accent, fontWeight: 600, minWidth: "1.5rem" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>
                    <strong style={{ color: "#fff", fontWeight: 600 }}>{step.title}.</strong>{" "}
                    {step.body}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── COSTS ── */}
        <section className="bc-section bc-section-light" id="costs">
          <div className="bc-shell">
            <div className="bc-section-head">
              <p className="bc-eyebrow">Know what it costs to run</p>
              <h2 className="bc-h2">The standard batch is free to run.</h2>
              <p className="bc-lead">
                Noise reduction, upscaling, natural contrast and cutout use no Adobe
                credits at all.
              </p>
            </div>

            <div className="bc-compare">
              <div className="bc-compare-card is-win">
                <span className="bc-compare-label">Standard batch</span>
                <p className="bc-compare-title">No credits</p>
                <p className="bc-small">
                  Runs entirely on your computer with Photoshop&apos;s own tools.
                </p>
              </div>
              <span className="bc-compare-vs" aria-hidden="true">or</span>
              <div className="bc-compare-card">
                <span className="bc-compare-label">Premium AI regenerate (optional)</span>
                <p className="bc-compare-title">About 5¢ per photo</p>
                <p className="bc-small">
                  Uses generative credits from your own Adobe account: about 10 credits
                  a photo (roughly $5 per 100 photos on Adobe&apos;s smallest credit
                  plan). Off by default. Each batch shows the credits it will use before
                  it starts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── WHO IT'S FOR ── */}
        <section className="bc-section" id="why">
          <div className="bc-shell bc-why-grid">
            <div className="bc-section-head">
              <p className="bc-eyebrow">Requirements</p>
              <h2 className="bc-h2">Adobe Photoshop 2026, Mac or Windows.</h2>
              <p className="bc-lead">
                Signed in to your Adobe account. The script and its action set install
                into Photoshop&apos;s Scripts folder; the actions load themselves the
                first time you run it.
              </p>
            </div>
            {penguinOk && (
              <img
                className="bc-mascot"
                src={PENGUIN_SRC}
                alt="Pressmark the penguin mascot"
                loading="lazy"
                onError={() => setPenguinOk(false)}
              />
            )}
          </div>
        </section>

        {/* ── PURCHASE ── */}
        <section className="bc-section bc-section-light" id="pricing">
          <div className="bc-shell">
            <div className="bc-proof">
              <strong>Enhance and cut out a whole folder without leaving Photoshop.</strong>
              <span>One-time purchase · {TRIAL_PHOTOS}-photo trial · no subscription.</span>
            </div>

            <div className="bc-purchase">
              <div className="bc-purchase-side">
                <p className="bc-h2 bc-product-version">Pressmark Enhance + Cutout v{VERSION}</p>
                <ul className="bc-feature-list">
                  {INCLUDED.map((item) => (
                    <li key={item}>
                      <Tick />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bc-purchase-side">
                <p className="bc-what-you-get">
                  <strong>{PRICE}, once.</strong> Your license key arrives on the next
                  page and by email, and the download starts straight away.
                </p>
                <div className="bc-cta-row">
                  {trialButton}
                  {buyButton}
                </div>
                {error && (
                  <p role="alert" className="bc-error">
                    {error}
                  </p>
                )}
                <p className="bc-small">
                  Already bought it? Email{" "}
                  <a href="mailto:support@pressmark.studio">support@pressmark.studio</a>{" "}
                  and we&apos;ll resend your key.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bc-footer">
        <div className="bc-shell bc-footer-inner">
          <span>© Pressmark Studio</span>
          <ul className="bc-footer-links">
            <li>
              <a href="/privacy.html">Privacy</a>
            </li>
            <li>
              <a href="mailto:support@pressmark.studio">Support</a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
