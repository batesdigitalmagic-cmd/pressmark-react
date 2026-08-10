import {
  BlogCTA,
  Prose,
  RelatedPosts,
  SiteFooter,
  SiteHeader,
  TableOfContents,
} from "../blog/components.jsx";
import { BLOG_RESPONSIVE_CSS, FONT_STACK, GLOBAL_CSS, PAGE_X, PALETTE, S } from "../blog/theme.js";
import {
  BLOG_BASE,
  formatDate,
  getPostBySlug,
  getRelatedPosts,
} from "../data/blogPosts.js";

/*
 * The reusable article template. Which article renders is taken from the URL
 * path, so one component serves every post and adding an article never
 * touches this file.
 *
 * The <head> for each article — title, description, canonical, Open Graph,
 * Twitter card, and JSON-LD — is written into static HTML at build time by
 * scripts/generate-blog-pages.mjs. Setting those here would be too late:
 * social scrapers don't execute JavaScript.
 */
function slugFromPath() {
  const parts = window.location.pathname.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "";
}

export default function Article() {
  const post = getPostBySlug(slugFromPath());

  if (!post) {
    return (
      <div style={S.page}>
        <style>{GLOBAL_CSS + BLOG_RESPONSIVE_CSS}</style>
        <SiteHeader />
        <main style={{ padding: `clamp(8rem, 16vw, 11rem) ${PAGE_X} clamp(5rem, 10vw, 7rem)`, maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ ...S.h1, fontSize: "clamp(1.9rem, 5vw, 2.75rem)", marginBottom: "1rem" }}>Article not found</h1>
          <p style={{ ...S.lead, marginBottom: "2rem" }}>
            That article may have moved or been renamed.
          </p>
          <a href={BLOG_BASE} className="pm-btn-primary" style={S.btnPrimary}>
            Back to Insights
          </a>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const related = getRelatedPosts(post);

  return (
    <div style={S.page}>
      <style>{GLOBAL_CSS + BLOG_RESPONSIVE_CSS}</style>
      <SiteHeader />

      {/* Dark editorial masthead, matching the site's hero treatment. */}
      <header
        style={{
          background: PALETTE.ink,
          color: PALETTE.white,
          padding: `clamp(7rem, 13vw, 9.5rem) ${PAGE_X} clamp(2.5rem, 6vw, 4rem)`,
          borderBottom: `1px solid ${PALETTE.borderOnDark}`,
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <nav aria-label="Breadcrumb" style={{ marginBottom: "1.75rem" }}>
            <ol style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", margin: 0, padding: 0, fontSize: "0.72rem", letterSpacing: "0.06em", color: PALETTE.textOnDarkMuted }}>
              <li><a href="/" style={{ color: PALETTE.textOnDarkMuted, textDecoration: "none" }}>Home</a></li>
              <li aria-hidden="true">/</li>
              <li><a href={BLOG_BASE} style={{ color: PALETTE.textOnDarkMuted, textDecoration: "none" }}>Insights</a></li>
              <li aria-hidden="true">/</li>
              <li><a href={`${BLOG_BASE}#${post.category}`} style={{ color: PALETTE.accent, textDecoration: "none" }}>{post.category}</a></li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" style={{ color: PALETTE.textOnDark }}>{post.title}</li>
            </ol>
          </nav>

          <div style={{ fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: PALETTE.accent, marginBottom: "1rem" }}>
            {post.category}
          </div>

          <h1 style={{ ...S.h1, color: PALETTE.white, fontSize: "clamp(2rem, 5vw, 3.4rem)", maxWidth: 900, marginBottom: "1.25rem" }}>
            {post.title}
          </h1>

          <p style={{ ...S.lead, color: PALETTE.textOnDark, maxWidth: 720, marginBottom: "1.75rem" }}>{post.excerpt}</p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", fontSize: "0.78rem", color: PALETTE.textOnDarkMuted }}>
            <span style={{ color: PALETTE.white }}>{post.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
            {post.updatedDate && post.updatedDate !== post.publishedDate && (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {formatDate(post.updatedDate)}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{post.readingTime} min read</span>
          </div>
        </div>
      </header>

      <main>
        <figure style={{ margin: 0, background: PALETTE.paper }}>
          <img
            src={post.featuredImage}
            alt={post.featuredImageAlt}
            style={{ display: "block", width: "100%", maxHeight: "clamp(280px, 46vw, 560px)", objectFit: "cover" }}
          />
        </figure>

        <div style={{ padding: `clamp(2.5rem, 6vw, 4.5rem) ${PAGE_X} clamp(3rem, 7vw, 5rem)` }}>
          <div
            className="article-layout"
            style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: "clamp(2rem, 5vw, 4rem)", alignItems: "start" }}
          >
            <article>
              <Prose content={post.content} />
              <BlogCTA />
              <RelatedPosts posts={related} />
            </article>

            <aside className="article-toc" style={{ position: "sticky", top: "6rem" }}>
              <TableOfContents content={post.content} />
              <div style={{ border: `1px solid ${PALETTE.hairline}`, padding: "1.5rem" }}>
                <div style={{ fontFamily: FONT_STACK, fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.6rem" }}>
                  Pressmark Studio
                </div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.7, color: PALETTE.textMuted, marginBottom: "1.1rem" }}>
                  Publication design, data merge, and print production for schools,
                  churches, and organizations.
                </p>
                <a href="/#contact" style={{ fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: PALETTE.accent, textDecoration: "none" }}>
                  Request a Quote →
                </a>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
