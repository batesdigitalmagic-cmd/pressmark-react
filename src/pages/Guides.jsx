/*
 * /guides — the Data Merge education hub.
 *
 * ── Why a hub and not just the blog ──
 *
 * /blog is everything the studio has written, newest first. This is the reading
 * order for one job: understanding what Data Merge is, getting a spreadsheet
 * right, and knowing what happens to it afterwards. The articles themselves
 * live in blogPosts.js like every other article — this page curates, it does
 * not duplicate.
 *
 * GUIDE_SLUGS is an explicit list rather than a category filter because the
 * order is the argument. A new article joins the hub by being added here.
 */

import AppShell from "../instant-proof/components/AppShell.jsx";
import { BLOG_BASE, POSTS } from "../data/blogPosts.js";

const GUIDE_SLUGS = [
  "how-to-fill-out-csv-church-directory",
  "what-is-indesign-data-merge",
  "spreadsheet-to-print-ready-pdf",
  "clean-data-better-directory-designs",
  "prepare-photos-church-directory",
  "create-photo-directory-from-csv",
];

const GUIDES = GUIDE_SLUGS.map((slug) => POSTS.find((post) => post.slug === slug)).filter(Boolean);

export default function Guides() {
  return (
    <AppShell current="/guides">
      <p className="ip-crumb">Data Merge guides</p>
      <h1 className="ip-h1">How spreadsheets become publications</h1>
      <p className="ip-lead">
        Everything you need to prepare a directory yourself: what a CSV is, why the headings
        matter, and what automation does with them once they are right.
      </p>

      <ol className="ip-list-plain" style={{ marginTop: "var(--proof-space-6)" }}>
        {GUIDES.map((post, index) => (
          <li className="ip-card" key={post.slug}>
            <div className="ip-card-head">
              <h2 className="ip-card-title">
                <a href={`${BLOG_BASE}/${post.slug}`}>
                  {index + 1}. {post.title}
                </a>
              </h2>
              <span className="ip-tag">{post.readingTime} min</span>
            </div>
            <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-2)" }}>
              {post.excerpt}
            </p>
          </li>
        ))}
      </ol>

      <section className="ip-prose" style={{ marginTop: "var(--proof-space-7)" }}>
        <h2>Skip the reading</h2>
        <p>
          If you already have your information in a spreadsheet, you do not need any of this to
          start. <a href="/">Download the template</a>, paste your rows into it, and upload it —
          the page checks the file and tells you plainly if anything is wrong.
        </p>
        <p>
          <a href="/how-it-works">How the whole process works</a> ·{" "}
          <a href={BLOG_BASE}>All Pressmark Insights articles</a>
        </p>
      </section>
    </AppShell>
  );
}
