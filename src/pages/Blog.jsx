/*
 * /blog — the Blog.
 *
 * Every published article, newest first, for a reader who comes back often.
 * Where the Data Merge section is arranged around a buyer's questions, this is
 * arranged around time: today's post at the top, then everything before it,
 * month by month.
 *
 * ── Built for a post a day ──
 *
 * The newest post leads, large. The rest are grouped under their month, so a
 * returning reader can see at a glance where they left off. The page shows a
 * month's worth at a time and grows on request, so a year of daily posts is
 * still one quick page rather than a 365-card wall.
 *
 * Only posts whose date has arrived are shown (isPublished), which is what lets
 * posts be written ahead and released one per day.
 *
 * ── Filtering ──
 *
 * The chosen topic is mirrored in the URL hash, like the Data Merge section, so
 * an article's topic breadcrumb (/blog#Yearbooks) opens the feed filtered.
 */

import { useEffect, useState } from "react";

import AppShell from "../instant-proof/components/AppShell.jsx";
import { CategoryFilter, HireUs, PostCard } from "../blog/shell.jsx";
import { BLOG_CSS } from "../blog/styles.css.js";
import { BLOG_BASE, BLOG_META, CATEGORIES, getPublishedPosts } from "../data/blogPosts.js";

const ALL = "All";
/* About a month of daily posts per screenful. */
const PAGE_SIZE = 30;

function categoryFromHash() {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  return CATEGORIES.includes(hash) ? hash : ALL;
}

/* "September 2026", read in UTC like every publishedDate. */
const monthOf = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/* Consecutive posts from the same month, in order. The input is already newest first. */
function groupByMonth(posts) {
  const groups = [];
  for (const post of posts) {
    const month = monthOf(post.publishedDate);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.posts.push(post);
    else groups.push({ month, posts: [post] });
  }
  return groups;
}

export default function Blog() {
  const [category, setCategory] = useState(categoryFromHash);
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    const onHash = () => {
      setCategory(categoryFromHash());
      setShown(PAGE_SIZE);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const choose = (next) => {
    setCategory(next);
    setShown(PAGE_SIZE);
    const url = new URL(window.location.href);
    url.hash = next === ALL ? "" : encodeURIComponent(next);
    window.history.replaceState({}, "", url);
  };

  const published = getPublishedPosts();
  const posts = category === ALL ? published : published.filter((post) => post.category === category);
  const [latest, ...older] = posts;
  const visible = older.slice(0, shown);
  const remaining = older.length - visible.length;

  return (
    <AppShell current={BLOG_BASE}>
      <style>{BLOG_CSS}</style>

      <p className="ip-crumb">{BLOG_META.name}</p>
      <h1 className="ip-h1">{BLOG_META.tagline}</h1>
      <p className="ip-lead bl-lead">{BLOG_META.intro}</p>

      <CategoryFilter categories={CATEGORIES} active={category} onChange={choose} />

      {latest ? (
        <section className="bl-group" aria-labelledby="bl-latest">
          <div className="bl-group-head">
            <h2 className="bl-group-title" id="bl-latest">
              {category === ALL ? "Latest" : `Latest in ${category}`}
            </h2>
          </div>
          <div style={{ marginTop: "var(--proof-space-4)" }}>
            <PostCard post={latest} featured />
          </div>
        </section>
      ) : (
        <p className="ip-lead">Nothing in {category} yet.</p>
      )}

      {groupByMonth(visible).map((group) => (
        <section className="bl-group" key={group.month} aria-label={group.month}>
          <div className="bl-group-head">
            <h2 className="bl-group-title">{group.month}</h2>
            <p className="bl-group-note">
              {group.posts.length} post{group.posts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="bl-grid">
            {group.posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ))}

      {remaining > 0 && (
        <p style={{ marginTop: "var(--proof-space-6)" }}>
          <button type="button" className="ip-btn" onClick={() => setShown((count) => count + PAGE_SIZE)}>
            Show older posts
          </button>
        </p>
      )}

      <div style={{ marginTop: "var(--proof-space-7)" }}>
        <HireUs heading="Have a publication that has to be right?" />
      </div>
    </AppShell>
  );
}
