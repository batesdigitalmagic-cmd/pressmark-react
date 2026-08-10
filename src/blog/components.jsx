/*
 * Pressmark Insights — shared components.
 *
 * Kept in one module because they share the token set and are only ever used
 * together; splitting seven small components across seven files would add
 * imports without adding clarity.
 *
 *   SiteHeader          nav matching the marketing site
 *   SiteFooter          footer matching the marketing site
 *   BlogHero            index page hero
 *   BlogCategoryFilter  category chips
 *   BlogCard            article card (regular + featured variants)
 *   TableOfContents     derived from h2/h3 content blocks
 *   RelatedPosts        cluster-aware related articles
 *   BlogCTA             services call to action
 *   Prose               renders content blocks
 *
 * SiteHeader and SiteFooter are rebuilt here rather than imported from
 * App.jsx, which exports nothing. Refactoring a live production page to
 * extract them would risk the marketing site for no functional gain; the
 * tokens are shared, so they stay visually identical.
 */

import { useEffect, useMemo, useState } from "react";
import {
  FONT_STACK,
  PAGE_X,
  PALETTE,
  S,
  TITLE_FONT_STACK,
  PROSE_W,
  headingId,
} from "./theme.js";
import { BLOG_BASE, formatDate, postUrl } from "../data/blogPosts.js";
import logo from "../assets/pressmark studio logo main.png";
import footerLogo from "../assets/pressmark-cream-footer-logo.png";

const NAV_LINKS = [
  { label: "About", href: "/#about" },
  { label: "Services", href: "/#services" },
  { label: "Why Us", href: "/#why" },
  { label: "Process", href: "/#process" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Products", href: "/buy" },
  { label: "Insights", href: BLOG_BASE },
];

/* ── inline [label](/href) links inside content text ── */
function InlineText({ text }) {
  const parts = useMemo(() => {
    const out = [];
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) out.push(text.slice(last, match.index));
      out.push({ label: match[1], href: match[2] });
      last = match.index + match[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [text]);

  return (
    <>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          part
        ) : (
          <a key={index} href={part.href}>
            {part.label}
          </a>
        )
      )}
    </>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          background: scrolled ? "rgba(2,8,20,0.97)" : "rgba(2,8,20,0.78)",
          backdropFilter: "blur(16px)",
          borderBottom: scrolled ? `1px solid ${PALETTE.border}` : "1px solid transparent",
          transition: "all 0.3s ease",
          padding: `0 ${PAGE_X}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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

        <ul className="blog-desktop-nav" style={{ display: "flex", gap: "1.6rem", listStyle: "none", margin: 0, padding: 0 }}>
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="blog-nav-link"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#b7c7df",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          className="blog-hamburger"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", flexDirection: "column", gap: 5, padding: "4px 0" }}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 24, height: 2, background: PALETTE.white, display: "block" }} />
          ))}
        </button>
      </nav>

      <div
        style={{
          position: "fixed",
          top: 68,
          left: 0,
          right: 0,
          zIndex: 190,
          background: PALETTE.white,
          borderBottom: `1px solid ${PALETTE.border}`,
          padding: `1.25rem ${PAGE_X} 1.75rem`,
          transform: open ? "translateY(0)" : "translateY(-130%)",
          transition: "transform 0.35s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            style={{
              fontSize: "1rem",
              color: PALETTE.text,
              textDecoration: "none",
              padding: "0.75rem 0",
              borderBottom: `1px solid ${PALETTE.border}`,
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer style={{ background: PALETTE.inkDeep, padding: `2.5rem ${PAGE_X}`, borderTop: `1px solid ${PALETTE.border}` }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.4rem", textAlign: "center" }}>
        <img src={footerLogo} alt="Pressmark Studio" style={{ width: "clamp(100px, 12vw, 145px)", height: "auto" }} />
        <div style={{ fontSize: "0.72rem", color: PALETTE.textOnDarkMuted, letterSpacing: "0.05em", lineHeight: 1.6 }}>
          Publication Design • Data Merge • Directory Design • Publication Rescue
          <br />
          Serving Schools, Teams &amp; Organizations
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.textOnDarkMuted, textDecoration: "none" }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>
          © {new Date().getFullYear()} Pressmark Studio. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export function BlogHero({ meta }) {
  return (
    <header
      style={{
        background: PALETTE.ink,
        color: PALETTE.white,
        padding: `clamp(7rem, 14vw, 10rem) ${PAGE_X} clamp(3.5rem, 8vw, 5.5rem)`,
        borderBottom: `1px solid ${PALETTE.borderOnDark}`,
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ ...S.eyebrow, marginBottom: "1.5rem" }}>
          <span style={S.eyebrowLine} />
          Pressmark Studio
        </div>
        <h1 style={{ ...S.h1, color: PALETTE.white, marginBottom: "1.25rem" }}>{meta.name}</h1>
        <p
          style={{
            fontFamily: FONT_STACK,
            fontSize: "clamp(1.15rem, 2.6vw, 1.7rem)",
            fontStyle: "italic",
            color: PALETTE.accent,
            marginBottom: "1.5rem",
            maxWidth: 760,
          }}
        >
          {meta.tagline}
        </p>
        <p style={{ ...S.lead, color: PALETTE.textOnDark, maxWidth: 680 }}>{meta.heroSupport}</p>
      </div>
    </header>
  );
}

export function BlogCategoryFilter({ categories, active, onChange }) {
  return (
    <nav aria-label="Article categories" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
      {categories.map((category) => {
        const isActive = category === active;
        return (
          <button
            key={category}
            className="pm-chip"
            onClick={() => onChange(category)}
            aria-pressed={isActive}
            style={{
              fontFamily: TITLE_FONT_STACK,
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0.6rem 1.1rem",
              cursor: "pointer",
              transition: "all 0.2s",
              border: `1px solid ${isActive ? PALETTE.accent : PALETTE.hairline}`,
              background: isActive ? PALETTE.accent : "transparent",
              color: isActive ? "#000" : PALETTE.textMuted,
            }}
          >
            {category}
          </button>
        );
      })}
    </nav>
  );
}

function CardMeta({ post }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.7rem", color: PALETTE.textMuted, letterSpacing: "0.06em" }}>
      <span>{formatDate(post.publishedDate)}</span>
      <span aria-hidden="true">·</span>
      <span>{post.readingTime} min read</span>
    </div>
  );
}

export function BlogCard({ post, featured = false }) {
  const image = (
    <img
      src={post.featuredImage}
      alt={post.featuredImageAlt}
      loading={featured ? "eager" : "lazy"}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "cover",
        background: PALETTE.ink,
      }}
    />
  );

  if (featured) {
    return (
      <article
        className="pm-card blog-featured"
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          border: `1px solid ${PALETTE.hairline}`,
          borderTop: `4px solid ${PALETTE.accent}`,
          background: PALETTE.white,
          overflow: "hidden",
        }}
      >
        <div style={{ aspectRatio: "4 / 3", overflow: "hidden" }}>{image}</div>
        <div style={{ padding: "clamp(1.75rem, 4vw, 3rem)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: "0.9rem" }}>
            Featured · {post.category}
          </div>
          <h2 style={{ ...S.h2, marginBottom: "1rem" }}>
            <a className="pm-card-title" href={postUrl(post)} style={{ color: PALETTE.text, textDecoration: "none", transition: "color 0.2s" }}>
              {post.title}
            </a>
          </h2>
          <p style={{ fontSize: "0.98rem", lineHeight: 1.75, color: PALETTE.textMuted, marginBottom: "1.5rem" }}>{post.excerpt}</p>
          <CardMeta post={post} />
          <a href={postUrl(post)} className="pm-btn-primary" style={{ ...S.btnPrimary, marginTop: "1.75rem", alignSelf: "flex-start" }}>
            Read Article
          </a>
        </div>
      </article>
    );
  }

  return (
    <article
      className="pm-card"
      style={{
        display: "flex",
        flexDirection: "column",
        border: `1px solid ${PALETTE.hairline}`,
        background: PALETTE.white,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div style={{ aspectRatio: "16 / 10", overflow: "hidden" }}>{image}</div>
      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: "0.7rem" }}>
          {post.category}
        </div>
        <h3 style={{ fontFamily: FONT_STACK, fontSize: "1.35rem", fontWeight: 800, lineHeight: 1.2, marginBottom: "0.7rem" }}>
          <a className="pm-card-title" href={postUrl(post)} style={{ color: PALETTE.text, textDecoration: "none", transition: "color 0.2s" }}>
            {post.title}
          </a>
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: PALETTE.textMuted, marginBottom: "1.25rem", flex: 1 }}>{post.excerpt}</p>
        <CardMeta post={post} />
        <a
          href={postUrl(post)}
          style={{ marginTop: "1rem", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.accent, textDecoration: "none" }}
        >
          Read Article →
        </a>
      </div>
    </article>
  );
}

export function TableOfContents({ content }) {
  const headings = useMemo(
    () =>
      content
        .filter((block) => block.type === "h2" || block.type === "h3")
        .map((block) => ({ ...block, id: headingId(block.text) })),
    [content]
  );

  // Short articles don't need one; a two-item contents list is noise.
  if (headings.length < 4) return null;

  return (
    <nav
      className="pm-toc"
      aria-label="Table of contents"
      style={{ background: PALETTE.paper, border: `1px solid ${PALETTE.hairline}`, padding: "1.5rem", marginBottom: "2.5rem" }}
    >
      <div style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: "0.9rem" }}>
        In this article
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {headings.map((heading) => (
          <li key={heading.id} style={{ marginBottom: "0.5rem", paddingLeft: heading.type === "h3" ? "1rem" : 0 }}>
            <a
              href={`#${heading.id}`}
              style={{
                fontSize: heading.type === "h3" ? "0.85rem" : "0.92rem",
                color: heading.type === "h3" ? PALETTE.textMuted : PALETTE.text,
                textDecoration: "none",
                lineHeight: 1.5,
                transition: "color 0.2s",
              }}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Prose({ content }) {
  return (
    <div className="pm-prose" style={{ maxWidth: PROSE_W }}>
      {content.map((block, index) => {
        switch (block.type) {
          case "h2":
            return (
              <h2
                key={index}
                id={headingId(block.text)}
                style={{ ...S.h2, fontSize: "clamp(1.5rem, 3vw, 2rem)", margin: "2.75rem 0 1rem", scrollMarginTop: "6rem" }}
              >
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={index}
                id={headingId(block.text)}
                style={{ fontFamily: FONT_STACK, fontSize: "clamp(1.2rem, 2.2vw, 1.45rem)", fontWeight: 800, margin: "2rem 0 0.75rem", scrollMarginTop: "6rem" }}
              >
                {block.text}
              </h3>
            );
          case "ul":
          case "ol": {
            const List = block.type === "ul" ? "ul" : "ol";
            return (
              <List key={index} style={{ margin: "0 0 1.5rem", paddingLeft: "1.35rem", color: PALETTE.textMuted, fontSize: "1rem", lineHeight: 1.8 }}>
                {block.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: "0.5rem" }}>
                    <InlineText text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "note":
            return (
              <aside
                key={index}
                style={{
                  margin: "0 0 1.75rem",
                  padding: "1.1rem 1.35rem",
                  background: PALETTE.paper,
                  borderLeft: `3px solid ${PALETTE.accent}`,
                  fontSize: "0.95rem",
                  lineHeight: 1.75,
                  color: PALETTE.textMuted,
                }}
              >
                <InlineText text={block.text} />
              </aside>
            );
          default:
            return (
              <p key={index} style={{ margin: "0 0 1.4rem", fontSize: "1.02rem", lineHeight: 1.85, color: PALETTE.textMuted }}>
                <InlineText text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

export function RelatedPosts({ posts }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="related-heading" style={{ marginTop: "clamp(3rem, 7vw, 5rem)" }}>
      <div style={{ ...S.eyebrow, marginBottom: "1.5rem" }}>
        <span style={S.eyebrowLine} />
        Keep reading
      </div>
      <h2 id="related-heading" style={{ ...S.h2, fontSize: "clamp(1.5rem, 3vw, 2rem)", marginBottom: "2rem" }}>
        Related Articles
      </h2>
      <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1.5rem" }}>
        {posts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}

export function BlogCTA() {
  return (
    <section
      style={{
        background: PALETTE.ink,
        color: PALETTE.white,
        padding: "clamp(2.5rem, 6vw, 4rem)",
        marginTop: "clamp(3rem, 7vw, 5rem)",
        borderTop: `4px solid ${PALETTE.accent}`,
      }}
    >
      <h2 style={{ ...S.h2, color: PALETTE.white, fontSize: "clamp(1.6rem, 3.2vw, 2.2rem)", marginBottom: "1rem" }}>
        Need Help With Your Publication?
      </h2>
      <p style={{ ...S.lead, color: PALETTE.textOnDark, maxWidth: 640, marginBottom: "2rem" }}>
        When your yearbook, directory, or publication has to be right, Pressmark Studio
        combines design, automation, data management, and print-production experience to
        get it production-ready.
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <a href="/#contact" className="pm-btn-primary" style={S.btnPrimary}>
          Request a Quote
        </a>
        <a href="/#services" className="pm-btn-ghost" style={S.btnGhost}>
          View Services
        </a>
      </div>
    </section>
  );
}
