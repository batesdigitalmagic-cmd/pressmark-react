import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Client code must never import server modules. lib/ and api/ read
    // STRIPE_SECRET_KEY, LICENSE_ADMIN_TOKEN and the Zoho credentials; Vite
    // inlines anything src/ touches straight into the browser bundle. This is
    // the equivalent of Next's `import 'server-only'` — a bad import fails the
    // build instead of silently shipping a secret.
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/lib/*', '**/api/*', '../lib/*', '../api/*', '../../lib/*', '../../api/*'],
            message:
              'src/ must not import from lib/ or api/ — those modules carry server-only secrets.',
          },
        ],
      }],
    },
  },
  {
    // Serverless functions and their shared libraries run on the server.
    files: ['api/**/*.js', 'lib/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.serviceworker },
    },
  },
])
