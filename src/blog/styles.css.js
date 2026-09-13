/*
 * The Data Merge section, in the site shell.
 *
 * The blog used to carry its own editorial chrome — a navy masthead, its own top
 * nav and footer, inline style objects from blog/theme.js. It now sits inside
 * AppShell like every other page, so everything here is written against the
 * shell's --proof-* tokens and is scoped under .ip-root, where those resolve.
 *
 * Only what the shell does not already provide lives here: post cards, the
 * category chips, the article's reading column and its content blocks.
 */

export const BLOG_CSS = `
  /* ── Section header ── */

  .bl-lead { max-width: 44em; }

  /* The "have it done for you" card. Buyers are who the section is for, so the
     route to a price is on every page, stated plainly rather than as a banner. */
  .bl-hire {
    display: grid;
    gap: var(--proof-space-3);
    margin-top: var(--proof-space-6);
  }
  .bl-hire h2 { font-size: 1.05rem; font-weight: 500; color: var(--proof-ink); margin: 0; }
  .bl-hire p { margin: 0; font-size: 0.92rem; line-height: 1.6; color: var(--proof-ink-soft); max-width: 46em; }
  .bl-hire-actions { display: flex; flex-wrap: wrap; gap: var(--proof-space-2); margin-top: var(--proof-space-2); }

  /* ── Category chips ── */

  .bl-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--proof-space-2);
    margin: var(--proof-space-6) 0 0;
    padding: 0;
    list-style: none;
  }
  .bl-chip {
    min-height: 36px;
    padding: 0 14px;
    border: 1px solid var(--proof-border);
    border-radius: 999px;
    background: var(--proof-surface);
    color: var(--proof-ink-soft);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .bl-chip:hover { border-color: var(--proof-border-strong); }
  .bl-chip[aria-pressed="true"] {
    background: var(--proof-accent);
    border-color: var(--proof-accent);
    color: #fff;
  }
  @media (pointer: coarse) { .bl-chip { min-height: 44px; } }

  /* ── Groups and cards ── */

  .bl-group { margin-top: var(--proof-space-7); }
  .bl-group-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--proof-space-3); flex-wrap: wrap; }
  .bl-group-title { font-size: 1.2rem; font-weight: 700; color: var(--proof-ink); margin: 0; }
  .bl-group-note { font-size: 0.85rem; color: var(--proof-muted); margin: 0; }

  .bl-grid { display: grid; gap: var(--proof-space-4); margin-top: var(--proof-space-4); }

  .bl-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--proof-surface);
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-lg);
    box-shadow: var(--proof-shadow);
    color: inherit;
    text-decoration: none;
  }
  .bl-card:hover { border-color: var(--proof-border-strong); }
  .bl-card img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    background: var(--proof-paper);
  }
  .bl-card-body { display: grid; gap: 6px; padding: var(--proof-space-4); }
  .bl-card-kicker { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--proof-accent); }
  .bl-card-title { font-size: 1.02rem; font-weight: 500; line-height: 1.35; color: var(--proof-ink); margin: 0; }
  .bl-card:hover .bl-card-title { text-decoration: underline; text-decoration-color: var(--proof-accent); text-underline-offset: 3px; }
  .bl-card-excerpt { font-size: 0.88rem; line-height: 1.55; color: var(--proof-muted); margin: 0; }
  .bl-card-meta { font-size: 0.78rem; color: var(--proof-muted); }

  /* The lead article reads larger, image beside text on a wide screen. */
  .bl-card-featured .bl-card-title { font-size: 1.3rem; }

  /* ── The article ── */

  .bl-breadcrumb { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 var(--proof-space-2); padding: 0; list-style: none; font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--proof-muted); }
  .bl-breadcrumb a { color: var(--proof-muted); text-decoration: none; }
  .bl-breadcrumb a:hover { color: var(--proof-accent); }
  .bl-meta { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-top: var(--proof-space-3); font-size: 0.82rem; color: var(--proof-muted); }

  .bl-hero {
    margin: var(--proof-space-5) 0 0;
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-lg);
    overflow: hidden;
    background: var(--proof-paper);
  }
  .bl-hero img { display: block; width: 100%; max-height: 420px; object-fit: cover; }

  .bl-layout { display: grid; gap: var(--proof-space-6); margin-top: var(--proof-space-6); }
  .bl-aside { display: grid; gap: var(--proof-space-4); align-content: start; }

  .bl-toc { padding: var(--proof-space-4); }
  .bl-toc-title { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--proof-accent); margin: 0 0 var(--proof-space-2); }
  .bl-toc ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .bl-toc a { color: var(--proof-ink-soft); text-decoration: none; font-size: 0.88rem; line-height: 1.45; }
  .bl-toc a:hover { color: var(--proof-accent); }
  .bl-toc .bl-toc-sub { padding-left: var(--proof-space-3); }
  .bl-toc .bl-toc-sub a { color: var(--proof-muted); font-size: 0.84rem; }

  /* ── Reading column ── */

  .bl-prose { max-width: 42rem; font-size: 1.02rem; line-height: 1.75; color: var(--proof-ink-soft); }
  .bl-prose > * + * { margin-top: var(--proof-space-4); }
  .bl-prose h2 { font-size: 1.45rem; font-weight: 700; line-height: 1.25; color: var(--proof-ink); margin-top: var(--proof-space-7); scroll-margin-top: 90px; }
  .bl-prose h3 { font-size: 1.15rem; font-weight: 500; color: var(--proof-ink); margin-top: var(--proof-space-6); scroll-margin-top: 90px; }
  .bl-prose ul, .bl-prose ol { padding-left: 1.3rem; }
  .bl-prose li + li { margin-top: 6px; }
  .bl-prose a { color: var(--proof-ink); text-decoration: underline; text-decoration-color: var(--proof-accent); text-underline-offset: 3px; }
  .bl-prose a:hover { color: var(--proof-accent); }

  .bl-note {
    padding: var(--proof-space-3) var(--proof-space-4);
    border-left: 3px solid var(--proof-accent);
    background: var(--proof-accent-soft);
    border-radius: 0 var(--proof-radius) var(--proof-radius) 0;
    font-size: 0.95rem;
  }

  /* A vertical flow, on the light ground now: the navy block it used to be was
     the old blog's chrome, not part of the content. */
  .bl-pipeline {
    list-style: none;
    padding: var(--proof-space-5) var(--proof-space-4);
    border: 1px solid var(--proof-border);
    border-radius: var(--proof-radius-lg);
    background: var(--proof-surface);
    text-align: center;
  }
  .bl-pipeline li { font-size: 0.9rem; font-weight: 500; color: var(--proof-ink); }
  .bl-pipeline-arrow { display: block; color: var(--proof-accent); line-height: 1.8; }

  .bl-back { margin-top: var(--proof-space-6); font-size: 0.9rem; }
  .bl-back a { color: var(--proof-ink-soft); }

  /* ── Wider screens ── */

  @media (min-width: 640px) {
    .bl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (min-width: 900px) {
    .bl-card-featured { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
    .bl-card-featured img { height: 100%; aspect-ratio: auto; }
    .bl-card-featured .bl-card-body { align-content: center; padding: var(--proof-space-5); }
  }
  /* The contents list moves beside the text only where both fit. Below this it
     sits above the article, where it is still useful and never cramped. */
  @media (min-width: 1200px) {
    .bl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .bl-layout { grid-template-columns: minmax(0, 1fr) 260px; }
    .bl-aside { position: sticky; top: var(--proof-space-5); order: 2; }
  }
`;
