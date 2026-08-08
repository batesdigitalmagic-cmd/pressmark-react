import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Multi-page: the marketing site and the storefront build as separate
      // entries, so /buy and /success ship none of App.jsx and App.jsx is
      // unaffected by anything here.
      input: {
        main: 'index.html',
        buy: 'buy.html',
        success: 'success.html',
        portal: 'portal.html',
        health: 'health.html',
        sandbox: 'sandbox.html',
        sandboxPortal: 'sandbox-portal.html',
      },
    },
  },
})
