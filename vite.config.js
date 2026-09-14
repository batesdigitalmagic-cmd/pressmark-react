import { readdirSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Put the Adobe Fonts stylesheet in every page's <head>.
 *
 * The site is set in News Gothic Std (see src/fonts.js), which is licensed
 * rather than committed. Set PRESSMARK_ADOBE_FONTS_KIT to an Adobe Fonts web
 * project id and this adds the two tags every page needs; leave it unset and
 * nothing is added at all, so an unconfigured build has no broken request in it
 * and the stack simply falls through to the local fallbacks.
 *
 * A build-time <link> rather than a runtime one: a stylesheet injected by
 * script is discovered late, so the whole page paints in the fallback and then
 * reflows once the real face arrives.
 */
function adobeFonts() {
  const kit = String(process.env.PRESSMARK_ADOBE_FONTS_KIT || '').trim()
  return {
    name: 'pressmark-adobe-fonts',
    transformIndexHtml() {
      if (!kit) return []
      return [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://use.typekit.net', crossorigin: '' }, injectTo: 'head-prepend' },
        { tag: 'link', attrs: { rel: 'stylesheet', href: `https://use.typekit.net/${kit}.css` }, injectTo: 'head-prepend' },
      ]
    },
  }
}

/*
 * Serve /blog locally the way Vercel does.
 *
 * The Blog index is blog/index.html. Vercel's cleanUrls serves it at /blog, but
 * Vite's dev and preview servers only find a directory's index.html with a
 * trailing slash — without one they fall back to the root index.html, so every
 * "Blog" link opened the homepage locally. Rewriting the one path keeps the
 * links as /blog, which is the canonical address.
 */
function blogIndex() {
  const rewrite = (req, _res, next) => {
    if (req.url === '/blog' || req.url.startsWith('/blog?') || req.url.startsWith('/blog#')) {
      req.url = '/blog/' + req.url.slice('/blog'.length)
    }
    next()
  }
  return {
    name: 'pressmark-blog-index',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

// Blog pages are generated from src/data/blogPosts.js by
// scripts/generate-blog-pages.mjs (npm prebuild). Globbing them means adding
// an article never requires touching this file.
function blogInputs() {
  try {
    return Object.fromEntries(
      readdirSync('blog')
        .filter((f) => f.endsWith('.html'))
        .map((f) => [`blog-${f.replace(/\.html$/, '')}`, `blog/${f}`])
    )
  } catch {
    return {}
  }
}

// https://vite.dev/config/
export default defineConfig({
  /*
   * Dev only. `api/**` are Vercel Functions, which `vite dev` does not serve,
   * so /instant-proof's fetch to /api/render-jobs would 404 locally. Point it
   * at scripts/dev-api-server.mjs, which hosts the real handlers against real
   * storage. Has no effect on the production build — Vercel routes these paths
   * itself.
   */
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3100',
        changeOrigin: false,
      },
    },
  },
  plugins: [react(), adobeFonts(), blogIndex()],
  build: {
    rollupOptions: {
      // Multi-page: the tool, each content route, the storefront, and every
      // blog article build as separate entries with their own static <head>.
      input: {
        /* The tool. `/instant-proof` is redirected here by vercel.json. */
        main: 'index.html',
        directoryDesigns: 'directory-designs.html',
        dataMerge: 'data-merge.html',
        howItWorks: 'how-it-works.html',
        services: 'services.html',
        pricing: 'pricing.html',
        contact: 'contact.html',
        buy: 'buy.html',
        success: 'success.html',
        portal: 'portal.html',
        health: 'health.html',
        privacy: 'privacy.html',
        sandbox: 'sandbox.html',
        sandboxPortal: 'sandbox-portal.html',
        ...blogInputs(),
      },
    },
  },
})
