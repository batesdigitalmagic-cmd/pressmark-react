/*
 * /data-merge — the Data Merge section.
 *
 * Written for organisations that want data merge done for them. It shows only
 * the data merge articles, leads with the one that explains what data merge is,
 * and ends at a price. Everything else the studio writes is on the Blog.
 *
 * The articles themselves live at /blog/<slug>; this page is a second, narrower
 * door onto the same pages, so nothing already indexed has moved.
 *
 * ── Filtering ──
 *
 * Client-side over an already-loaded array. The chosen topic is mirrored in the
 * URL hash, so an article's topic breadcrumb (/data-merge#Directories) opens the
 * section already filtered, and a filtered view can be shared.
 */

import { useEffect, useState } from "react";

import AppShell from "../instant-proof/components/AppShell.jsx";
import { CategoryFilter, HireUs, PostCard } from "../blog/shell.jsx";
import { BLOG_CSS } from "../blog/styles.css.js";
import {
  BLOG_BASE,
  DATA_MERGE_BASE,
  DATA_MERGE_CATEGORIES,
  DATA_MERGE_META,
  getFeaturedPost,
  getPublishedPosts,
  isDataMerge,
} from "../data/blogPosts.js";

const ALL = "All";
const TOPICS = [ALL, ...DATA_MERGE_CATEGORIES];

/* The topic named in the hash, if it is one of this section's. */
function categoryFromHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return TOPICS.includes(hash) ? hash : ALL;
}

export default function DataMerge() {
  const [category, setCategory] = useState(categoryFromHash);

  /* Follow back/forward through filtered views. */
  useEffect(() => {
    const onHash = () => setCategory(categoryFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const choose = (next) => {
    setCategory(next);
    const url = new URL(window.location.href);
    url.hash = next === ALL ? "" : encodeURIComponent(next);
    window.history.replaceState({}, "", url);
  };

  const posts = getPublishedPosts().filter(isDataMerge);
  const featured = getFeaturedPost();
  const rest = posts.filter((post) => post.slug !== featured.slug);
  const filtered = posts.filter((post) => post.category === category);

  return (
    <AppShell current={DATA_MERGE_BASE}>
      <style>{BLOG_CSS}</style>

      <p className="ip-crumb">{DATA_MERGE_META.name}</p>
      <h1 className="ip-h1">{DATA_MERGE_META.tagline}</h1>
      <p className="ip-lead bl-lead">{DATA_MERGE_META.intro}</p>

      <HireUs />

      <CategoryFilter categories={TOPICS} active={category} onChange={choose} />

      {category === ALL ? (
        <section className="bl-group" aria-labelledby="bl-dm">
          <div className="bl-group-head">
            <h2 className="bl-group-title" id="bl-dm">
              Data merge
            </h2>
            <p className="bl-group-note">What it is, what it takes, and when to hand it over.</p>
          </div>
          <div style={{ marginTop: "var(--proof-space-4)" }}>
            <PostCard post={featured} featured />
          </div>
          <div className="bl-grid">
            {rest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ) : (
        <section className="bl-group" aria-labelledby="bl-topic">
          <div className="bl-group-head">
            <h2 className="bl-group-title" id="bl-topic">
              {category}
            </h2>
            <p className="bl-group-note">
              {filtered.length} article{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="bl-grid">
            {filtered.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}

      <p className="bl-back">
        <a href={BLOG_BASE}>Yearbooks, print production and more on the Blog →</a>
      </p>

      <div style={{ marginTop: "var(--proof-space-7)" }}>
        <HireUs heading="Have a publication that has to be right?" />
      </div>
    </AppShell>
  );
}
