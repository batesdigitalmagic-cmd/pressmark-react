/*
 * The Data Merge section's building blocks, for pages inside AppShell.
 *
 * These replace the old editorial components (SiteHeader, BlogHero, BlogCard,
 * Prose…), which carried their own navy chrome and inline style objects. The
 * content model is unchanged — articles are still the structured blocks in
 * src/data/blogPosts.js — only the presentation moved into the shell.
 *
 * Styling is in BLOG_CSS (styles.css.js), which each page injects once.
 */

import { useId, useMemo } from "react";

import { formatDate, postUrl } from "../data/blogPosts.js";
import { headingId } from "./theme.js";

/** `[label](/href)` inside article text, as real links. */
export function InlineText({ text }) {
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
          <a
            key={index}
            href={part.href}
            {...(/^https?:\/\//i.test(part.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {part.label}
          </a>
        )
      )}
    </>
  );
}

/** An article's body, one structured block at a time. */
export function Prose({ content }) {
  return (
    <div className="bl-prose">
      {content.map((block, index) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={index} id={headingId(block.text)}>
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={index} id={headingId(block.text)}>
                {block.text}
              </h3>
            );
          case "ul":
          case "ol": {
            const List = block.type;
            return (
              <List key={index}>
                {block.items.map((item, i) => (
                  <li key={i}>
                    <InlineText text={item} />
                  </li>
                ))}
              </List>
            );
          }
          case "pipeline":
            /* An ordered list, so a screen reader announces a sequence rather
               than a column of arrows. */
            return (
              <ol key={index} className="bl-pipeline">
                {block.steps.map((step, i) => (
                  <li key={step}>
                    {step}
                    {i < block.steps.length - 1 && (
                      <span className="bl-pipeline-arrow" aria-hidden="true">
                        ↓
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            );
          case "note":
            return (
              <aside key={index} className="bl-note">
                <InlineText text={block.text} />
              </aside>
            );
          case "cta":
            return (
              <p key={index}>
                <a className="ip-btn" href={block.href}>
                  {block.label}
                </a>
              </p>
            );
          default:
            return (
              <p key={index}>
                <InlineText text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

/** "In this article". Short pieces do without — a two-line contents list is noise. */
export function TableOfContents({ content }) {
  const headings = useMemo(
    () =>
      content
        .filter((block) => block.type === "h2" || block.type === "h3")
        .map((block) => ({ ...block, id: headingId(block.text) })),
    [content]
  );
  if (headings.length < 4) return null;

  return (
    <nav className="ip-card bl-toc" aria-label="In this article">
      <p className="bl-toc-title">In this article</p>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id} className={heading.type === "h3" ? "bl-toc-sub" : undefined}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PostCard({ post, featured = false, headingLevel = 3 }) {
  const Title = `h${headingLevel}`;
  return (
    <a className={featured ? "bl-card bl-card-featured" : "bl-card"} href={postUrl(post)}>
      <img src={post.featuredImage} alt="" loading={featured ? "eager" : "lazy"} />
      {/* A div, not a span: it holds a heading, and a heading inside an inline
          element is invalid markup. An <a> may wrap a div in HTML5. */}
      <div className="bl-card-body">
        <span className="bl-card-kicker">{post.category}</span>
        <Title className="bl-card-title">{post.title}</Title>
        <p className="bl-card-excerpt">{post.excerpt}</p>
        <span className="bl-card-meta">
          {formatDate(post.publishedDate)} · {post.readingTime} min read
        </span>
      </div>
    </a>
  );
}

export function CategoryFilter({ categories, active, onChange }) {
  return (
    <ul className="bl-chips" aria-label="Filter by topic">
      {categories.map((category) => (
        <li key={category}>
          <button
            type="button"
            className="bl-chip"
            aria-pressed={category === active}
            onClick={() => onChange(category)}
          >
            {category}
          </button>
        </li>
      ))}
    </ul>
  );
}

/*
 * The route to a price.
 *
 * The section is written for organisations that want this done for them, so
 * every page offers that plainly: what we do, and the one button that starts
 * it. /pricing sits beside it for the reader who wants a number first.
 */
export function HireUs({ heading = "Want data merge done for you?" }) {
  /* useId, because the index shows this twice and a fixed id would label both
     sections with the first heading. */
  const titleId = useId();
  return (
    <section className="ip-card bl-hire" aria-labelledby={titleId}>
      <h2 id={titleId}>{heading}</h2>
      <p>
        Pressmark Studio builds directories, yearbooks and member publications from your
        spreadsheet — cleaning the data, setting it in InDesign, and delivering a print-ready
        file. Send us what you have and we will come back with a price.
      </p>
      <div className="bl-hire-actions">
        <a className="ip-btn" href="/contact">
          Request a price
        </a>
        <a className="ip-btn" href="/pricing">
          See pricing
        </a>
      </div>
    </section>
  );
}
