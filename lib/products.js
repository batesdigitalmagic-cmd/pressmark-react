/*
 * The products pressmark.studio sells. Source of truth for checkout, the
 * webhook, the success page and downloads. Mirrors the license server's
 * src/lib/products.js (same ids, same seat counts) — keep the two in step.
 *
 * SERVER ONLY for the price-id lookups (they read process.env). The plain
 * catalogue fields are also safe for the browser via src/storefront/products.js.
 *
 * Stripe price ids live in environment variables, one per product per mode:
 *
 *   batchcutout    STRIPE_PRICE_ID                   STRIPE_TEST_PRICE_ID
 *   enhancecutout  STRIPE_PRICE_ID_ENHANCECUTOUT     STRIPE_TEST_PRICE_ID_ENHANCECUTOUT
 *
 * BatchCutout keeps its original variable names, so the live store needs no
 * change to keep selling it.
 */

export const PRODUCTS = {
  batchcutout: {
    id: "batchcutout",
    name: "Pressmark BatchCutout",
    shortName: "BatchCutout",
    description: "Batch background removal for Adobe Photoshop",
    maxDevices: 2,
    updateMonths: 12,
    page: "/buy",
  },
  enhancecutout: {
    id: "enhancecutout",
    name: "Pressmark Enhance + Cutout",
    shortName: "Enhance + Cutout",
    description: "Batch-enhance and cut out a folder of photos in Adobe Photoshop",
    maxDevices: 2,
    updateMonths: 12,
    page: "/enhance-cutout",
  },
};

export const DEFAULT_PRODUCT = "batchcutout";

/** Product id for a raw request value: missing -> default, unknown -> null. */
export function resolveProduct(raw) {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_PRODUCT;
  const id = String(raw).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PRODUCTS, id) ? id : null;
}

export function getProduct(id) {
  return PRODUCTS[id] || PRODUCTS[DEFAULT_PRODUCT];
}

/* Literal property reads (not computed) so the set of variables this app uses
   stays greppable, matching lib/releases.js and api/health.js. */
const PRICE_IDS = {
  live: {
    batchcutout: (process.env.STRIPE_PRICE_ID || "").trim(),
    enhancecutout: (process.env.STRIPE_PRICE_ID_ENHANCECUTOUT || "").trim(),
  },
  test: {
    batchcutout: (process.env.STRIPE_TEST_PRICE_ID || "").trim(),
    enhancecutout: (process.env.STRIPE_TEST_PRICE_ID_ENHANCECUTOUT || "").trim(),
  },
};

/** "" when that product has no price configured in that mode. */
export function productPriceId(mode, id) {
  return (PRICE_IDS[mode] && PRICE_IDS[mode][id]) || "";
}

/** Relative download link for a product (served by api/download.js). */
export function downloadPath(id) {
  return id === DEFAULT_PRODUCT ? "/api/download" : `/api/download?product=${id}`;
}
