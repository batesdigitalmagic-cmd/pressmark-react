/*
 * One article in the Data Merge section.
 *
 * Which article renders is taken from the URL path, so one component serves
 * every post and adding an article never touches this file.
 *
 * The <head> for each article — title, description, canonical, Open Graph,
 * Twitter card and JSON-LD — is written into static HTML at build time by
 * scripts/generate-blog-pages.mjs. Setting those here would be too late: social
 * scrapers do not execute JavaScript.
 *
 * It sits in AppShell like every other page. The article used to open under a
 * full-width navy masthead with its own nav; a reader arriving from search now
 * lands in the same site as the tool, one sidebar entry away from making a PDF
 * or asking for a price.
 */

import AppShell from "../instant-proof/components/AppShell.jsx";
import { HireUs, PostCard, Prose, TableOfContents } from "../blog/shell.jsx";
import { BLOG_CSS } from "../blog/styles.css.js";
import {
  BLOG_BASE,
  BLOG_META,
  formatDate,
  getPostBySlug,
  getRelatedPosts,
  isPublished,
  sectionFor,
} from "../data/blogPosts.js";

function slugFromPath() {
  const parts = window.location.pathname.replace(/\/+$/, "").replace(/\.html$/, "").split("/");
  return parts[parts.length - 1] || "";
}

export default function Article() {
  const found = getPostBySlug(slugFromPath());
  /* A post dated ahead has no page in the build, but the dev server serves any
     slug; treat it as not found there too. */
  const post = found && isPublished(found) ? found : null;

  if (!post) {
    return (
      <AppShell current={BLOG_BASE}>
        <p className="ip-crumb">{BLOG_META.name}</p>
        <h1 className="ip-h1">Article not found</h1>
        <p className="ip-lead">That article may have moved or been renamed.</p>
        <p style={{ marginTop: "var(--proof-space-5)" }}>
          <a className="ip-btn" href={BLOG_BASE}>
            Back to {BLOG_META.name}
          </a>
        </p>
      </AppShell>
    );
  }

  const related = getRelatedPosts(post);
  /* A data merge article belongs to the Data Merge section; anything else to
     the Blog. That decides the breadcrumb and which sidebar entry is lit. */
  const section = sectionFor(post);

  return (
    <AppShell current={section.href}>
      <style>{BLOG_CSS}</style>

      <nav aria-label="Breadcrumb">
        <ol className="bl-breadcrumb">
          <li>
            <a href={section.href}>{section.name}</a>
          </li>
          {/* An article filed under "Data Merge" in the Data Merge section would
              read "Data Merge / Data Merge"; the topic crumb is dropped when it
              only repeats the section. */}
          {post.category !== section.name && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <a href={`${section.href}#${encodeURIComponent(post.category)}`}>{post.category}</a>
              </li>
            </>
          )}
        </ol>
      </nav>

      <h1 className="ip-h1">{post.title}</h1>
      <p className="ip-lead bl-lead">{post.excerpt}</p>
      <p className="bl-meta">
        <span>{post.author}</span>
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
      </p>

      <figure className="bl-hero">
        <img src={post.featuredImage} alt={post.featuredImageAlt} />
      </figure>

      <div className="bl-layout">
        <aside className="bl-aside">
          <TableOfContents content={post.content} />
        </aside>

        <article>
          <Prose content={post.content} />

          <div style={{ marginTop: "var(--proof-space-7)" }}>
            <HireUs />
          </div>

          {related.length > 0 && (
            <section className="bl-group" aria-labelledby="bl-related">
              <div className="bl-group-head">
                <h2 className="bl-group-title" id="bl-related">
                  Keep reading
                </h2>
              </div>
              <div className="bl-grid">
                {related.map((item) => (
                  <PostCard key={item.slug} post={item} />
                ))}
              </div>
            </section>
          )}

          <p className="bl-back">
            <a href={section.href}>← All {section.name === BLOG_META.name ? "blog posts" : "data merge articles"}</a>
          </p>
        </article>
      </div>
    </AppShell>
  );
}
