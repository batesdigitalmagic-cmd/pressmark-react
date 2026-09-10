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
        gap: "0.75rem 1rem",
        flexWrap: "wrap",
        /*
         * minHeight, not height. The nav wraps at narrow widths, and a fixed
         * height clipped the wrapped row — at 320px the second line of links
         * was cut off by the header's own edge. Letting the bar grow is the
         * only thing that keeps every link reachable on a small phone.
         */
        minHeight: 68,
        paddingBlock: "0.6rem",
      }}
    >
      <a
        href="/"
        aria-label="Pressmark Studio home"
        style={{ display: "flex", alignItems: "center", minHeight: 44 }}
      >
        <img
          src={logo}
          alt="Pressmark Studio"
          style={{ display: "block", width: "clamp(130px, 16vw, 175px)", height: "auto", maxHeight: 40, objectFit: "contain" }}
        />
      </a>
      <nav
        aria-label="Site"
        style={{
          display: "flex",
          /* Tighter row gap than column gap: wrapped rows need breathing space,
             adjacent links do not. */
          gap: "0.25rem 1.15rem",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="ip-nav-link"
            style={{
              /* 12.5px. At 0.72rem these were 11.5px — under the 12px floor
                 that stays comfortable on a phone, and uppercase with
                 letter-spacing reads smaller still. */
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#b7c7df",
              textDecoration: "none",
              /* A 44px tap target. The text is ~15px tall on its own, which is
                 a hard thing to hit accurately with a thumb. */
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

/*
 * Footer links carry the same floor as the header's: 12.5px rather than 11.5px,
 * and a 44px tap height. They were 11.5px text in a 13px-tall box, which is
 * both hard to read and hard to hit on a phone.
 */
const footerLinkStyle = {
  fontSize: "0.78rem",
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: PALETTE.textOnDarkMuted,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
};

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
        <div style={{ fontSize: "0.78rem", color: PALETTE.textOnDarkMuted, letterSpacing: "0.05em", lineHeight: 1.6 }}>
          Publication Design • Data Merge • Directory Design • Publication Rescue
          <br />
          Serving Schools, Teams &amp; Organizations
        </div>
        <div style={{ display: "flex", gap: "0 1.15rem", flexWrap: "wrap", justifyContent: "center" }}>
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} style={footerLinkStyle}>
              {link.label}
            </a>
          ))}
          <a href="/privacy" style={footerLinkStyle}>
            Privacy
          </a>
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.35)" }}>
          © {new Date().getFullYear()} Pressmark Studio. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
