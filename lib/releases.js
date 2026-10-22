/*
 * The release registry — the single source of truth for which versions exist
 * and where each one lives.
 *
 * api/download.js and api/license/version.js both read from here. They used to
 * carry parallel copies of this map (version.js said "Mirrors api/download.js"),
 * which is the shape of bug where a release ships from one endpoint and 404s
 * from the other because only one copy got updated.
 *
 * Storage URLs are never written into source. Each is an environment variable,
 * so the file can move between storage providers without a code change — the
 * whole reason /api/download exists as an indirection in the first place.
 *
 * Each lookup below is a literal, static property access on process.env rather
 * than a computed key. That matches the existing code and keeps the set of
 * variables this app reads greppable, which is what api/health.js reports on.
 *
 * TO ADD A RELEASE: add the version to RELEASES, add its variable name to
 * RELEASE_ENV_VARS, and bump LATEST. Nothing else needs editing — health
 * checks and the plugin update endpoint both derive from these three.
 */

/* version -> direct download URL (must return the file itself, not a storage
   preview page). Old versions stay here forever: purchase emails are permanent
   and someone reinstalling an older build shouldn't have to email support. */
export const RELEASES = {
  "1.0.0": process.env.DOWNLOAD_URL_1_0_0 || "",
  "1.1.0": process.env.DOWNLOAD_URL_1_1_0 || "",
  "1.2.0": process.env.DOWNLOAD_URL_1_2_0 || "",
};

/* The newest release. What the plugin's update check compares against, and the
   default target of /api/download when no ?v= is given. */
export const LATEST = "1.2.0";

/* CURRENT_VERSION can pin /api/download's default to an older release — useful
   to roll back a bad release without a deploy. Unset means "serve LATEST",
   which is what you want almost always.

   NOTE: because this is an override, a stale CURRENT_VERSION left set to an old
   release in the dashboard will keep serving that release even after LATEST
   moves. Clear it or update it when you ship. */
export const CURRENT = (process.env.CURRENT_VERSION || "").trim() || LATEST;

/* ── Pressmark Enhance + Cutout ──
   Same rules as above, separate list. TO ADD A RELEASE: add it here, add its
   variable to RELEASE_ENV_VARS, and bump ENHANCECUTOUT_LATEST. */
export const ENHANCECUTOUT_RELEASES = {
  "1.0.0": process.env.DOWNLOAD_URL_ENHANCECUTOUT_1_0_0 || "",
};
export const ENHANCECUTOUT_LATEST = "1.0.0";
export const ENHANCECUTOUT_CURRENT =
  (process.env.CURRENT_VERSION_ENHANCECUTOUT || "").trim() || ENHANCECUTOUT_LATEST;

const BY_PRODUCT = {
  batchcutout: { releases: RELEASES, latest: LATEST, current: CURRENT },
  enhancecutout: {
    releases: ENHANCECUTOUT_RELEASES,
    latest: ENHANCECUTOUT_LATEST,
    current: ENHANCECUTOUT_CURRENT,
  },
};

function forProduct(product) {
  return BY_PRODUCT[product] || BY_PRODUCT.batchcutout;
}

/** Newest release of a product (what its update check compares against). */
export function latestFor(product = "batchcutout") {
  return forProduct(product).latest;
}

/** What /api/download serves when no version is asked for. */
export function currentFor(product = "batchcutout") {
  return forProduct(product).current;
}

/* Every download variable this app reads, so api/health.js can report on the
   real set instead of keeping its own hand-maintained copy. */
export const RELEASE_ENV_VARS = [
  "DOWNLOAD_URL_1_0_0",
  "DOWNLOAD_URL_1_1_0",
  "DOWNLOAD_URL_1_2_0",
  "DOWNLOAD_URL_ENHANCECUTOUT_1_0_0",
];

/* Configured storage URL for a version, or "" when that version is unknown or
   has no storage set. Callers treat "" as "no download available" — telling a
   customer a release exists with no way to fetch it is worse than a clean 404.
   No product means BatchCutout, which is what every existing caller means. */
export function releaseUrl(version, product = "batchcutout") {
  return forProduct(product).releases[version] || "";
}

/* Versions that are actually downloadable right now. A version present in
   the list but with an unset variable is deliberately excluded. */
export function availableVersions(product = "batchcutout") {
  const releases = forProduct(product).releases;
  return Object.keys(releases).filter((version) => releases[version]);
}
