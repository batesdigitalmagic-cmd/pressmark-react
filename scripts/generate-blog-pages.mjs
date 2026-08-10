/*
 * Generates one static HTML entry per blog article, plus the index, a sitemap,
 * and robots.txt.
 *
 *   npm run build   (runs automatically via prebuild)
 *
 * ── Why generate HTML instead of setting tags in React ──
 *
 * This is a client-rendered app. Anything React writes into <head> happens
 * after JavaScript executes — and the crawlers that matter most for sharing
 * (Facebook, LinkedIn, Twitter/X, Slack, iMessage) do not execute JavaScript
 * at all. An Open Graph tag set in a useEffect is invisible to every one of
 * them. Google renders JS but defers it, which delays indexing.
 *
 * Baking the tags into real HTML at build time is the only approach that
 * actually satisfies the SEO requirements. It also costs nothing at runtime.
 *
 * Adding an article means adding an object to src/data/blogPosts.js. This
 * script produces its page, route, meta tags, JSON-LD, and sitemap entry.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "blog");

const {
  POSTS,
  BLOG_META,
  SITE_URL,
  BLOG_BASE,
  AUTHOR,
} = await import(resolve(ROOT, "src/data/blogPosts.js"));

const escape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/* JSON-LD goes inside a <script> tag, where the only sequence that can break
   out is "</". Escaping the angle bracket is enough and keeps the JSON valid. */
const jsonLd = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

function head({ title, description, canonical, image, imageAlt, type = "website", extra = "" }) {
  const absoluteImage = image ? `${SITE_URL}${image}` : `${SITE_URL}/icons.svg`;
  return `    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=2" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <link rel="canonical" href="${escape(canonical)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />

    <meta property="og:type" content="${type}" />
    <meta property="og:site_name" content="Pressmark Studio" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${escape(canonical)}" />
    <meta property="og:image" content="${escape(absoluteImage)}" />
    <meta property="og:image:alt" content="${escape(imageAlt || title)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(description)}" />
    <meta name="twitter:image" content="${escape(absoluteImage)}" />
    <meta name="twitter:image:alt" content="${escape(imageAlt || title)}" />
${extra}`;
}

function page({ headHtml, entry }) {
  return `<!doctype html>
<html lang="en">
  <head>
${headHtml}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entry}"></script>
  </body>
</html>
`;
}

function breadcrumbLd(post) {
  const items = [
    { name: "Home", url: SITE_URL },
    { name: "Insights", url: `${SITE_URL}${BLOG_BASE}` },
    { name: post.category, url: `${SITE_URL}${BLOG_BASE}#${encodeURIComponent(post.category)}` },
    { name: post.title, url: `${SITE_URL}${BLOG_BASE}/${post.slug}` },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function articleLd(post) {
  const url = `${SITE_URL}${BLOG_BASE}/${post.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    image: [`${SITE_URL}${post.featuredImage}`],
    datePublished: post.publishedDate,
    dateModified: post.updatedDate || post.publishedDate,
    author: { "@type": "Organization", name: post.author || AUTHOR, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Pressmark Studio",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icons.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: post.category,
    wordCount: post.content
      .map((block) => block.text || (block.items || []).join(" "))
      .join(" ")
      .split(/\s+/).length,
  };
}

/* Rebuild from scratch each time, so a renamed or deleted slug never leaves an
   orphan page behind that would still be crawlable. */
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

// ── index ──
writeFileSync(
  resolve(OUT_DIR, "index.html"),
  page({
    entry: "/src/blog.jsx",
    headHtml: head({
      title: `${BLOG_META.name} — ${BLOG_META.tagline} | Pressmark Studio`,
      description: BLOG_META.intro,
      canonical: `${SITE_URL}${BLOG_BASE}`,
      image: POSTS.find((p) => p.featured)?.featuredImage,
      imageAlt: BLOG_META.name,
      extra: `    <script type="application/ld+json">${jsonLd({
        "@context": "https://schema.org",
        "@type": "Blog",
        name: BLOG_META.name,
        description: BLOG_META.intro,
        url: `${SITE_URL}${BLOG_BASE}`,
        publisher: { "@type": "Organization", name: "Pressmark Studio", url: SITE_URL },
        blogPost: POSTS.map((post) => ({
          "@type": "BlogPosting",
          headline: post.title,
          url: `${SITE_URL}${BLOG_BASE}/${post.slug}`,
          datePublished: post.publishedDate,
        })),
      })}</script>\n`,
    }),
  })
);

// ── one page per article ──
for (const post of POSTS) {
  writeFileSync(
    resolve(OUT_DIR, `${post.slug}.html`),
    page({
      entry: "/src/article.jsx",
      headHtml: head({
        title: post.seoTitle,
        description: post.metaDescription,
        canonical: `${SITE_URL}${BLOG_BASE}/${post.slug}`,
        image: post.featuredImage,
        imageAlt: post.featuredImageAlt,
        type: "article",
        extra:
          `    <meta property="article:published_time" content="${post.publishedDate}" />\n` +
          `    <meta property="article:modified_time" content="${post.updatedDate || post.publishedDate}" />\n` +
          `    <meta property="article:section" content="${escape(post.category)}" />\n` +
          `    <script type="application/ld+json">${jsonLd(articleLd(post))}</script>\n` +
          `    <script type="application/ld+json">${jsonLd(breadcrumbLd(post))}</script>\n`,
      }),
    })
  );
}

// ── sitemap + robots ──
const staticRoutes = ["/", "/buy", BLOG_BASE];
const urls = [
  ...staticRoutes.map((route) => ({ loc: `${SITE_URL}${route}`, priority: route === "/" ? "1.0" : "0.8" })),
  ...POSTS.map((post) => ({
    loc: `${SITE_URL}${BLOG_BASE}/${post.slug}`,
    lastmod: post.updatedDate || post.publishedDate,
    priority: post.featured ? "0.9" : "0.7",
  })),
];

writeFileSync(
  resolve(ROOT, "public/sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url>\n    <loc>${url.loc}</loc>\n${url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>\n` : ""}    <priority>${url.priority}</priority>\n  </url>`
  )
  .join("\n")}
</urlset>
`
);

writeFileSync(
  resolve(ROOT, "public/robots.txt"),
  `User-agent: *
Allow: /

# Transactional and internal pages carry noindex in their own markup.
Disallow: /success
Disallow: /sandbox
Disallow: /sandbox-portal
Disallow: /health

Sitemap: ${SITE_URL}/sitemap.xml
`
);

const generated = readdirSync(OUT_DIR).length;
console.log(`[blog] ${generated} pages, ${POSTS.length} articles, sitemap + robots.txt written`);
