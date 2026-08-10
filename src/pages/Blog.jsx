import { useState } from "react";
import {
  BlogCTA,
  BlogCard,
  BlogCategoryFilter,
  BlogHero,
  SiteFooter,
  SiteHeader,
} from "../blog/components.jsx";
import { BLOG_RESPONSIVE_CSS, GLOBAL_CSS, PAGE_X, S } from "../blog/theme.js";
import {
  BLOG_META,
  CATEGORIES,
  POSTS,
  getFeaturedPost,
} from "../data/blogPosts.js";

/*
 * /blog — the index.
 *
 * Filtering is client-side over an already-loaded array. With dozens of posts
 * that is instant and needs no extra requests; at several hundred it would be
 * worth paginating, which is a change to this file alone.
 */
export default function Blog() {
  const [category, setCategory] = useState("All");

  const featured = getFeaturedPost();
  const rest = POSTS.filter((post) => post.slug !== featured.slug);
  const visible = category === "All" ? rest : rest.filter((post) => post.category === category);
  const showFeatured = category === "All" || featured.category === category;

  return (
    <div style={S.page}>
      <style>{GLOBAL_CSS + BLOG_RESPONSIVE_CSS}</style>
      <SiteHeader />

      <BlogHero meta={BLOG_META} />

      <main>
        <section style={{ padding: `clamp(2.5rem, 6vw, 4rem) ${PAGE_X} 0` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <p style={{ ...S.lead, maxWidth: 780, marginBottom: "2.5rem" }}>{BLOG_META.intro}</p>
            <BlogCategoryFilter categories={CATEGORIES} active={category} onChange={setCategory} />
          </div>
        </section>

        {showFeatured && (
          <section style={{ padding: `clamp(2.5rem, 5vw, 3.5rem) ${PAGE_X} 0` }}>
            <div style={{ maxWidth: 1240, margin: "0 auto" }}>
              <BlogCard post={featured} featured />
            </div>
          </section>
        )}

        <section style={{ padding: `clamp(2.5rem, 5vw, 3.5rem) ${PAGE_X} clamp(4rem, 9vw, 6rem)` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            {visible.length === 0 ? (
              <p style={{ ...S.lead }}>
                No articles in this category yet. Choose <strong>All</strong> to see everything.
              </p>
            ) : (
              <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1.75rem" }}>
                {visible.map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={{ padding: `0 ${PAGE_X} clamp(4rem, 9vw, 6rem)` }}>
          <div style={{ maxWidth: 1240, margin: "0 auto" }}>
            <BlogCTA />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
