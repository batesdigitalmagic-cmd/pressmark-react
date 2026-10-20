# Launching Pressmark Enhance + Cutout

Two products, one Stripe account, one license server:

| | BatchCutout | Enhance + Cutout |
|---|---|---|
| Product id | `batchcutout` | `enhancecutout` |
| Price | $10 (`STRIPE_PRICE_ID`) | $19.99 (`STRIPE_PRICE_ID_ENHANCECUTOUT`) |
| Keys | `PMBC-…` (store), `PMK-…` (server) | `PME-XXXX-XXXX-XXXX` |
| Computers | 2 | 2 |
| Free trial | 30 photos | 10 photos |
| Download | `/api/download` | `/api/download?product=enhancecutout` |

Stripe price ids (not secret):

- live: `price_1USV4PJedwC1ciWm4I1n8T4p`
- test: `price_1USVBdJedwC1ciWmOplCbXby`

Every step below is reversible until step 6. Do them in order.

## 0. Backups (done 2026-10-20)

`Documents/Pressmark Studio/Backups/license-server-2026-10-20/`: deployed
server source (checksummed) and a verified copy of the production database.
Fly also keeps daily volume snapshots (`vol_rkg8de2y038626y4`).

## 1. Deploy the license server (backward compatible)

From `Documents/Pressmark Studio/license-server/server` (the git copy whose
first commit is exactly what was live):

```bash
export PATH="$HOME/.fly/bin:$PATH"
cd "$HOME/Documents/Pressmark Studio/license-server/server"
npm ci && npm test            # 26 tests, all must pass
fly deploy -a pressmark-license
```

On first boot the server adds a `product` column to trials (every existing
row kept, as BatchCutout). Then check:

```bash
curl https://license.pressmark.studio/health
fly logs -a pressmark-license | grep migrate   # "[migrate] trials: ... kept N row(s)"
```

Nothing customer-facing changes: BatchCutout v1.1/v1.2 send no product and
are treated as BatchCutout. Signing key, secrets and tokens are untouched.

Rollback: `fly releases -a pressmark-license`, then
`fly deploy -a pressmark-license --image <previous image>`. The added column
is ignored by the old code.

## 2. Staging license server for sandbox purchases (recommended)

So test purchases never write to the production database:

```bash
fly apps create pressmark-license-staging
fly volumes create license_data -a pressmark-license-staging -r iad -s 1
npm run genkeys      # prints a NEW staging-only private key, ADMIN_TOKEN, DOWNLOAD_SECRET
fly secrets set -a pressmark-license-staging \
  LICENSE_PRIVATE_KEY="<the printed LICENSE_PRIVATE_KEY value>" \
  ADMIN_TOKEN="<printed ADMIN_TOKEN>" DOWNLOAD_SECRET="<printed DOWNLOAD_SECRET>"
fly deploy -a pressmark-license-staging \
  --env PUBLIC_URL=https://pressmark-license-staging.fly.dev
```

(A new key pair for staging only. The production key is never touched:
`genkeys` only prints, it writes nothing, and these values go to the staging
app alone. The plugins don't verify signatures offline, so staging tokens work
in them unchanged.)

## 3. Storefront branch → Vercel preview

The branch `enhancecutout-launch` is in
`Documents/Pressmark Studio/Pressmark Website/enhancecutout-launch.bundle`:

```bash
cd <your pressmark-react clone>
git fetch "$HOME/Documents/Pressmark Studio/Pressmark Website/enhancecutout-launch.bundle" enhancecutout-launch:enhancecutout-launch
git push -u origin enhancecutout-launch     # opens a Vercel preview
```

Vercel → Settings → Environment Variables, **Preview** only:

- `STRIPE_TEST_PRICE_ID_ENHANCECUTOUT` = `price_1USVBdJedwC1ciWmOplCbXby`
- `LICENSE_API_URL_TEST` = `https://pressmark-license-staging.fly.dev`
- `LICENSE_ADMIN_TOKEN_TEST` = staging `ADMIN_TOKEN`
- `DOWNLOAD_URL_ENHANCECUTOUT_1_0_0` = the zip's direct-download URL

## 4. Test both products on the preview (sandbox cards only)

Use `/sandbox` on the preview, which has a test-buy button for each product
(card 4242 4242 4242 4242). Point the plugins at staging for this round: in each
script's license CFG, `api: 'https://pressmark-license-staging.fly.dev'`
(change it back before compiling the release).

1. Buy BatchCutout → key on /success and by email → activates in BatchCutout v1.2.
2. Buy Enhance + Cutout → `PME-` key, download starts by itself → activates in
   Enhance + Cutout.
3. Each product's key is refused by the other plugin ("That key is for …").
4. Third computer refused; release one in the portal; activate again.
5. Refund the Enhance order in Stripe (test mode) → the plugin reports the
   license revoked at its next check-in.
6. Your existing test BatchCutout key (`PMK-…`, deployment-test) still works.
7. `/api/health` → `enhancecutout.state` reads correctly.

## 5. Package Enhance + Cutout 1.0.0

In VS Code (ExtendScript Debugger): open `Pressmark_EnhanceCutout.jsx` →
"Export as Binary" → `Pressmark_EnhanceCutout.jsxbin`. Zip the folder
`Pressmark Enhance + Cutout/` containing:

- `Pressmark_EnhanceCutout.jsxbin`
- `Pressmark AI.atn`
- `READ ME - Quick Start.txt`

Upload the zip (WorkDrive, direct-download link), then register it on the
license server for the in-app update check:

```bash
npm run hash -- PressmarkEnhanceCutout-1.0.0.zip     # sha256
curl -X POST https://license.pressmark.studio/admin/releases \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"product":"enhancecutout","version":"1.0.0","external_url":"<zip url>","sha256":"<hash>"}'
```

## 6. Go live (point of no easy return: real customers)

1. Copy existing storefront keys to the license server:

   ```bash
   node --env-file=.env scripts/migrate-licenses-to-fly.mjs          # dry run
   node --env-file=.env scripts/migrate-licenses-to-fly.mjs --apply
   ```

   (Needs the live `KV_REST_API_*`, `LICENSE_API_URL=https://license.pressmark.studio`
   and `LICENSE_ADMIN_TOKEN` = production `ADMIN_TOKEN` in `.env`.)

2. Vercel **Production** env:
   - `LICENSE_API_URL` = `https://license.pressmark.studio`
   - `LICENSE_ADMIN_TOKEN` = production `ADMIN_TOKEN`
   - `STRIPE_PRICE_ID_ENHANCECUTOUT` = `price_1USV4PJedwC1ciWm4I1n8T4p`
   - `DOWNLOAD_URL_ENHANCECUTOUT_1_0_0` = zip URL
3. Fly production secret, so purchase emails link the right download:
   `fly secrets set -a pressmark-license DOWNLOAD_PAGE_URL_ENHANCECUTOUT=https://pressmark.studio/api/download?product=enhancecutout`
4. Merge `enhancecutout-launch` → production deploy.
5. `/api/health` → `ok: true`, `enhancecutout.state: "on sale"`.
6. One real $19.99 purchase with your own card, then refund it.

Rollback for the storefront: unset `LICENSE_API_URL` (keys minted while it
was set stay valid on the license server) and redeploy the previous build.

## Known follow-up: BatchCutout network handling

BatchCutout v1.2 treats every HTTP 403/404 as "license service not
responding", so a mistyped key shows the wrong message and refunds only take
effect when the 30-day offline token expires. Enhance + Cutout has the fix
(read the server's JSON before falling back); port it to BatchCutout 1.2.1,
along with its `$99` → `$10` price text.
