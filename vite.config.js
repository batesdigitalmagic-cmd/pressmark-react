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
        sandbox: 'sandbox.html',
        sandboxPortal: 'sandbox-portal.html',
        ...blogInputs(),
      },
    },
  },
})
