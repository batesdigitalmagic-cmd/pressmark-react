/*
 * Header and footer for the Instant Proof page.
 *
 * Rebuilt here rather than imported from src/blog/components.jsx, which pulls
 * in blogPosts.js (~80 KB of article content) purely to read BLOG_BASE. This
 * follows the precedent set in src/storefront/theme.js: a small entry point
 * should not drag a large module into its bundle. The tokens are shared, so
 * the chrome stays visually identical to the rest of the site.
 */

import { PAGE_X, PALETTE } from "../styles.js";
import logo from "../../assets/pressmark studio logo main.png";
import footerLogo from "../../assets/pressmark-cream-footer-logo.png";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/#services" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Insights", href: "/blog" },
  { label: "Products", href: "/buy" },
];

export function ProofHeader() {
  return (
    <header
      className="ip-no-print"
      style={{
        background: PALETTE.ink,
        borderBottom: `1px solid ${PALETTE.borderOnDark}`,
        padding: `0 ${PAGE_X}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        height: 68,
      }}
    >
      <a href="/" aria-label="Pressmark Studio home" style={{ display: "flex", alignItems: "center" }}>
        <img
          src={logo}
          alt="Pressmark Studio"
          style={{ display: "block", width: "clamp(130px, 16vw, 175px)", height: "auto", maxHeight: 40, objectFit: "contain" }}
        />
      </a>
      <nav aria-label="Site" style={{ display: "flex", gap: "1.4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="ip-nav-link"
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#b7c7df",
              textDecoration: "none",
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function ProofFooter() {
  return (
    <footer
      className="ip-no-print"
      style={{
        marginTop: "auto",
        background: PALETTE.inkDeep,
        padding: `2.5rem ${PAGE_X}`,
        borderTop: `1px solid ${PALETTE.border}`,
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.2rem",
          textAlign: "center",
        }}
      >
        <img src={footerLogo} alt="Pressmark Studio" style={{ width: "clamp(100px, 12vw, 145px)", height: "auto" }} />
        <div style={{ fontSize: "0.72rem", color: PALETTE.textOnDarkMuted, letterSpacing: "0.05em", lineHeight: 1.6 }}>
          Publication Design • Data Merge • Directory Design • Publication Rescue
          <br />
          Serving Schools, Teams &amp; Organizations
        </div>
        <div style={{ display: "flex", gap: "1.4rem", flexWrap: "wrap", justifyContent: "center" }}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: PALETTE.textOnDarkMuted,
                textDecoration: "none",
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/privacy"
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: PALETTE.textOnDarkMuted,
              textDecoration: "none",
            }}
          >
            Privacy
          </a>
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>
          © {new Date().getFullYear()} Pressmark Studio. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
