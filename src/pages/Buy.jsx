import { useCallback, useEffect, useState } from "react";
import { PALETTE } from "../storefront/theme.js";
import "./Buy.css";

/* ─────────────────────────────────────────────
   CONFIG — the knobs worth turning later

   Everything that is likely to change on a release (version string, price,
   screenshots, demo video, trial route) lives here rather than buried in the
   markup below.
───────────────────────────────────────────── */

/* Display-only version string for the page copy. */
const VERSION = "1.2.0";

/* Display copy only — the amount actually charged comes from the Stripe price
   ID on the server (api/checkout.js → PRODUCT.priceId). Keep the two in step. */
const PRICE = "$99";

/* The Pressmark Penguin. Served from public/ so the original vector artwork
   stays crisp at every screen size. */
const PENGUIN_SRC = "/pressmark-penguin.svg";

/* Lightweight animated walkthrough used in the batch-processing section. */
const DEMO_GIF = "/media/batchcutout-demo.gif";

/* The 30-photo trial is enforced inside the panel itself ("Free · 18 of 30
   photos left"), not by a separate website flow — so "try free" is simply the
   download. api/download.js is deliberately ungated for exactly this reason.
   It serves the current release from lib/releases.js. */
const TRIAL_URL = "/api/download";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Overview", href: "#overview" },
  { label: "At Scale", href: "#scale" },
  { label: "Examples", href: "#examples" },
  { label: "Pricing", href: "#pricing" },
  { label: "Blog", href: "/blog/" },
  { label: "My Licence", href: "/portal.html" },
];

const FEATURES = [
  "Process hundreds or thousands of images",
  "Runs directly inside Adobe Photoshop",
  "AI-powered subject detection",
  "Batch transparent PNG export",
  "Torn paper, rough-edge and sticker cutout styles",
];

/* Real product views shown in the automatically rotating hero carousel. */
const SHOTS = [
  {
    id: "panel",
    label: "Main BatchCutout interface",
    src: "/batchcutout-panel-1.2.0.png",
    alt:
      "The Pressmark BatchCutout v1.2.0 panel. Background type offers Different / complex (recommended), Mix of everything, and Consistent solid color, with tolerance, max long edge, and filename suffix fields, plus options to defringe 1px, trim to subject, include subfolders, and overwrite existing PNGs. The Cutout style side is set to Torn Paper with border width and colour, shadow opacity, blur, distance and colour, rough, grit, erosion and cleanup values, and extra canvas padding.",
    caption: "Choose detection, select a cutout style, and point BatchCutout at a folder.",
  },
  {
    id: "progress",
    label: "Batch processing and progress",
    src: "/batchcutout-progress.png",
    alt:
      "BatchCutout processing a folder unattended, with completed image thumbnails, the Pressmark penguin, current filename, progress bar, and completion percentage.",
    caption: "Progress across a full folder, file by file, without supervision.",
  },
  {
    id: "results",
    label: "Original and transparent PNG results",
    src: "/batchcutout-results.png",
    alt:
      "A BatchCutout before-and-after comparison showing an original image beside its transparent PNG cutout.",
    caption: "Originals stay untouched while every finished cutout exports as a transparent PNG.",
  },
  {
    id: "styles",
    label: "Eleven BatchCutout styles",
    src: "/batchcutout-styles.png",
    alt:
      "Eleven BatchCutout styles including transparent PNG, stickers, shadows, paper cutout, glow, spray paint, torn paper, rough edge, and distressed stamp.",
    caption: "Eleven production-ready cutout styles, applied consistently across the entire batch.",
  },
];

/* One real image through the complete BatchCutout workflow. */
const STAGES = [
  { step: "01", name: "Original", checker: false, key: "original" },
  { step: "02", name: "Background removed", checker: true, key: "removed" },
  { step: "03", name: "Styled cutout", checker: true, key: "styled" },
];

const EXAMPLE_STYLES = [
  {
    id: "portrait",
    name: "Portrait workflow",
    original: "/portrait-8-a.png",
    removed: "/portrait-8-b.png",
    styled: "/portrait-8-c.png",
  },
];

const AUDIENCES = [
  "Photographers",
  "Designers",
  "Print shops",
  "Yearbook producers",
  "E-commerce production",
  "Schools",
  "High-volume creative teams",
];

const INCLUDED = [
  "BatchCutout Photoshop script",
  "Free updates for Version 1.x",
  "License activation",
  "30-photo free trial",
  "No subscription",
];

/* ─────────────────────────────────────────────
   PIECES
───────────────────────────────────────────── */

function Tick() {
  return (
    <span className="bc-tick" aria-hidden="true">
      ✓
    </span>
  );
}

/* A slide: the real screenshot, or an obvious slot naming the file to add.
   A src that 404s falls back to the same slot, so a screenshot that has not
   been dropped in yet never renders as a broken image. */
function Shot({ shot }) {
  const [failed, setFailed] = useState(false);

  if (!shot.src || failed) {
    return (
      <div className="bc-shot-placeholder">
        <strong>{shot.label}</strong>
        <span className="bc-small">Screenshot slot — add the image at</span>
        <code>public{shot.suggestedPath || shot.src}</code>
      </div>
    );
  }

  return (
    <div className="bc-shot">
      <img src={shot.src} alt={shot.alt} loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

function Carousel({ shots }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = shots.length > 1;

  const go = useCallback(
    (next) => setIndex((next + shots.length) % shots.length),
    [shots.length],
  );

  const onKeyDown = (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
  };

  const current = shots[index];

  useEffect(() => {
    if (!many || paused) return undefined;

    const timer = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % shots.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [many, paused, shots.length]);

  return (
    <div
      className="bc-carousel"
      role="group"
      aria-roledescription="carousel"
      aria-label="BatchCutout screenshots"
      onKeyDown={many ? onKeyDown : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* Keyed so the failed-image state resets per slide rather than
          persisting onto the next screenshot. */}
      <Shot key={current.id} shot={current} />

      <p className="bc-carousel-caption">{current.caption}</p>

      {many && (
        <div className="bc-carousel-controls">
          <button
            type="button"
            className="bc-arrow"
            onClick={() => go(index - 1)}
            aria-label="Previous screenshot"
          >
            ‹
          </button>

          <ul className="bc-dots">
            {shots.map((shot, i) => (
              <li key={shot.id}>
                <button
                  type="button"
                  className="bc-dot-hit"
                  onClick={() => go(i)}
                  aria-current={i === index}
                  aria-label={`Show ${shot.label}`}
                >
                  <span className="bc-dot" data-active={i === index} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="bc-arrow"
            onClick={() => go(index + 1)}
            aria-label="Next screenshot"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

function Stage({ stage, src, styleName }) {
  return (
    <figure className="bc-stage">
      <div className={`bc-stage-frame${stage.checker ? " bc-checker" : ""}`}>
        {src ? (
          <img src={src} alt={`${styleName} — ${stage.name.toLowerCase()}`} loading="lazy" />
        ) : (
          <span className="bc-stage-empty">
            {stage.name}
            <br />
            example
          </span>
        )}
      </div>
      <figcaption className="bc-stage-caption">
        <span className="bc-stage-step">{stage.step}</span>
        <span className="bc-stage-name">{stage.name}</span>
      </figcaption>
    </figure>
  );
}

function BeforeAfter({ styles }) {
  const [activeId, setActiveId] = useState(styles[0].id);
  const active = styles.find((s) => s.id === activeId) ?? styles[0];

  return (
    <>
      {styles.length > 1 && (
        <div className="bc-style-tabs" role="tablist" aria-label="Cutout styles">
          {styles.map((style) => (
            <button
              key={style.id}
              type="button"
              role="tab"
              id={`tab-${style.id}`}
              className="bc-tab"
              aria-selected={style.id === activeId}
              aria-controls="bc-stage-panel"
              onClick={() => setActiveId(style.id)}
            >
              {style.name}
            </button>
          ))}
        </div>
      )}

      <div
        id="bc-stage-panel"
        className="bc-stages"
        role="tabpanel"
        aria-labelledby={styles.length > 1 ? `tab-${active.id}` : undefined}
      >
        {STAGES.map((stage) => (
          <Stage key={stage.key} stage={stage} src={active[stage.key]} styleName={active.name} />
        ))}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   PAGE
───────────────────────────────────────────── */

export default function Buy() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [penguinOk, setPenguinOk] = useState(true);

  const cancelled = new URLSearchParams(window.location.search).has("cancelled");

  /* Unchanged from the previous design — this is the live Stripe path. */
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

  const buyButton = (
    <button type="button" className="bc-btn bc-btn-primary" onClick={checkout} disabled={busy}>
      {busy ? "Opening checkout…" : `Buy BatchCutout — ${PRICE}`}
      {!busy && <span className="bc-btn-sub">One-time purchase · instant download</span>}
    </button>
  );

  /* PALETTE feeds the stylesheet, so theme.js remains the one place colours
     are defined for the storefront. */
  const tokens = {
    "--bc-accent": PALETTE.accent,
    "--bc-accent-dark": "#96693a",
    "--bc-ink": PALETTE.text,
    "--bc-muted": PALETTE.textMuted,
    "--bc-cream": PALETTE.keyBg,
    "--bc-border": PALETTE.border,
    "--bc-danger": PALETTE.danger,
  };

  return (
    <div className="bc-page" style={tokens}>
      {/* ── HEADER ── */}
      <header className="bc-header">
        <div className="bc-shell bc-header-inner">
          <a className="bc-product-brand" href="#overview">
            <img src={PENGUIN_SRC} alt="" width={42} height={42} />
            Pressmark BatchCutout
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
          <div className="bc-shell bc-hero-grid">
            <div className="bc-hero-copy">
              <h1 className="bc-h1">
                Remove Hundreds—or Thousands of Backgrounds Without Leaving Photoshop.
              </h1>

              <p className="bc-lead">
                Batch background removal and stylized cutouts built directly for Adobe
                Photoshop. Process entire folders automatically instead of cutting out
                images one at a time.
              </p>

              <ul className="bc-feature-list">
                {FEATURES.map((feature) => (
                  <li key={feature}>
                    <Tick />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="bc-price">
                <span className="bc-price-amount">{PRICE}</span>
                <span className="bc-price-term">One-Time Purchase</span>
                <span className="bc-price-note">
                  Pay once. No subscription, ever.
                </span>
              </div>

              {/* A cancelled checkout returns here rather than to a dead end —
                  the thing they were buying stays in front of them. */}
              {cancelled && (
                <div role="status" className="bc-notice">
                  <p className="bc-notice-title">
                    Checkout cancelled — you have not been charged.
                  </p>
                  <p className="bc-small">
                    Nothing was saved and no payment was taken. Start again whenever
                    you&apos;re ready, or email{" "}
                    <a href="mailto:support@pressmark.studio">support@pressmark.studio</a>{" "}
                    if something went wrong.
                  </p>
                </div>
              )}

              <div className="bc-cta-row">
                {buyButton}
                <a className="bc-btn bc-btn-secondary" href={TRIAL_URL}>
                  Try Free — 30 Photos
                  <span className="bc-btn-sub">No card required</span>
                </a>
              </div>

              {error && (
                <p role="alert" className="bc-error">
                  {error}
                </p>
              )}
            </div>

            <div className="bc-hero-media">
              <Carousel shots={SHOTS} />
            </div>
          </div>
        </section>

        {/* ── SCALE ── */}
        <section className="bc-section bc-section-dark" id="scale">
          <div className="bc-shell">
            <div className="bc-section-head">
              <p className="bc-eyebrow">Built for volume</p>
              <h2 className="bc-h2">See What Batch Processing Can Do</h2>
              <p className="bc-lead">
                BatchCutout is built for production environments — the days where the
                job is not one portrait but every portrait. Point it at a folder of
                hundreds or thousands of images and it works through the whole set,
                writing transparent PNGs while your originals stay exactly where they
                are.
              </p>
            </div>

            <div className="bc-compare">
              <div className="bc-compare-card">
                <span className="bc-compare-label">The old way</span>
                <p className="bc-compare-title">One image at a time</p>
                <p className="bc-small">
                  Open, select, remove, export, close. Repeat until the folder is
                  empty — an afternoon that scales linearly with the shoot.
                </p>
              </div>

              <span className="bc-compare-vs" aria-hidden="true">
                vs
              </span>

              <div className="bc-compare-card is-win">
                <span className="bc-compare-label">With BatchCutout</span>
                <p className="bc-compare-title">Entire folders automatically</p>
                <p className="bc-small">
                  Choose the folder, choose where cutouts land, and let Photoshop run
                  the set unattended. The work scales with the machine, not your day.
                </p>
              </div>
            </div>

            <figure className="bc-demo">
              <img
                src={DEMO_GIF}
                alt="Animated demonstration of Pressmark BatchCutout processing images in Photoshop"
                loading="lazy"
              />
            </figure>

          </div>
        </section>

        {/* ── BEFORE / AFTER ── */}
        <section className="bc-section bc-section-light" id="examples">
          <div className="bc-shell">
            <div className="bc-section-head">
              <p className="bc-eyebrow">Original → Background removed → Styled cutout</p>
              <h2 className="bc-h2">One Portrait. Three Production-Ready Stages.</h2>
              <p className="bc-lead">
                The same three steps run across the whole folder. Pick a finish and
                BatchCutout applies it consistently, image after image.
              </p>
            </div>

            <BeforeAfter styles={EXAMPLE_STYLES} />
          </div>
        </section>

        {/* ── WHY ── */}
        <section className="bc-section" id="why">
          <div className="bc-shell bc-why-grid">
            <div>
              <div className="bc-section-head">
                <p className="bc-eyebrow">Why BatchCutout</p>
                <h2 className="bc-h2">Built for Photoshop users who work at scale.</h2>
                <p className="bc-lead">
                  It runs inside the application you already trust, on the volumes that
                  make cutting out by hand impossible.
                </p>
              </div>

              <ul className="bc-audience">
                {AUDIENCES.map((audience) => (
                  <li key={audience}>{audience}</li>
                ))}
              </ul>
            </div>

            {penguinOk && (
              <img
                className="bc-mascot"
                src={PENGUIN_SRC}
                alt="Pressmark the penguin mascot holding a pen tool"
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
              <strong>
                Built for hundreds or thousands of images — without leaving Photoshop.
              </strong>
              <span>One-time purchase · 30-photo trial · no subscription.</span>
            </div>

            <div className="bc-purchase">
              <div className="bc-purchase-side">
                <p className="bc-eyebrow">Pressmark BatchCutout v{VERSION}</p>
                <div className="bc-price">
                  <span className="bc-price-amount">{PRICE}</span>
                  <span className="bc-price-term">One-Time Purchase</span>
                </div>
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
                  <strong>What you get:</strong> Batch background removal + transparent PNG
                  export + Torn Paper + Rough Edge + Sticker styles + Version 1.x updates.
                </p>

                <button
                  type="button"
                  className="bc-btn bc-btn-primary"
                  onClick={checkout}
                  disabled={busy}
                  style={{ alignSelf: "stretch" }}
                >
                  {busy ? "Opening checkout…" : `Get BatchCutout — ${PRICE}`}
                  {!busy && <span className="bc-btn-sub">Secure checkout via Stripe</span>}
                </button>

                <a
                  className="bc-btn bc-btn-secondary"
                  href={TRIAL_URL}
                  style={{ alignSelf: "stretch" }}
                >
                  Try Free — 30 Photos
                </a>

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

      {/* ── FOOTER ── */}
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
