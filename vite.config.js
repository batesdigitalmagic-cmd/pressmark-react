import { readdirSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
  build: {
    rollupOptions: {
      // Multi-page: the marketing site, the storefront, and every blog article
      // build as separate entries with their own static <head>.
      input: {
        main: 'index.html',
        buy: 'buy.html',
        success: 'success.html',
        portal: 'portal.html',
        health: 'health.html',
        privacy: 'privacy.html',
        instantProof: 'instant-proof.html',
        sandbox: 'sandbox.html',
        sandboxPortal: 'sandbox-portal.html',
        ...blogInputs(),
      },
    },
  },
})
