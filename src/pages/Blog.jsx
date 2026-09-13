/*
 * /blog — the Data Merge section.
 *
 * Written for organisations that want data merge done for them. It leads with
 * the data merge articles and keeps everything else the studio has written
 * underneath, at the same URLs, under "More from the studio".
 *
 * ── Filtering ──
 *
 * Client-side over an already-loaded array: with dozens of posts that is
 * instant and needs no requests. The chosen topic is mirrored in the URL hash,
 * so an article's category breadcrumb (/blog#Directories) opens the index
 * already filtered, and a filtered view can be shared.
 */

import { useEffect, useState } from "react";

import AppShell from "../instant-proof/components/AppShell.jsx";
import { CategoryFilter, HireUs, PostCard } from "../blog/shell.jsx";
import { BLOG_CSS } from "../blog/styles.css.js";
import {
  BLOG_META,
  CATEGORIES,
  DATA_MERGE_CATEGORIES,
  POSTS,
  getFeaturedPost,
} from "../data/blogPosts.js";

const ALL = "All";

/* The topic named in the hash, if it is one we have. */
function categoryFromHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return CATEGORIES.includes(hash) ? hash : ALL;
}

export default function Blog() {
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

  const featured = getFeaturedPost();
  const isDataMerge = (post) => DATA_MERGE_CATEGORIES.includes(post.category);
  const dataMerge = POSTS.filter((post) => isDataMerge(post) && post.slug !== featured.slug);
  const more = POSTS.filter((post) => !isDataMerge(post) && post.slug !== featured.slug);
  const filtered = POSTS.filter((post) => post.category === category);

  return (
    <AppShell current="/blog">
      <style>{BLOG_CSS}</style>

      <p className="ip-crumb">{BLOG_META.name}</p>
      <h1 className="ip-h1">{BLOG_META.tagline}</h1>
      <p className="ip-lead bl-lead">{BLOG_META.intro}</p>

      <HireUs />

      <CategoryFilter categories={CATEGORIES} active={category} onChange={choose} />

      {category === ALL ? (
        <>
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
              {dataMerge.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>

          {more.length > 0 && (
            <section className="bl-group" aria-labelledby="bl-more">
              <div className="bl-group-head">
                <h2 className="bl-group-title" id="bl-more">
                  More from the studio
                </h2>
                <p className="bl-group-note">Yearbooks, print production and Photoshop automation.</p>
              </div>
              <div className="bl-grid">
                {more.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </div>
            </section>
          )}
        </>
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

      <div style={{ marginTop: "var(--proof-space-7)" }}>
        <HireUs heading="Have a publication that has to be right?" />
      </div>
    </AppShell>
  );
}
