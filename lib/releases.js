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
};

/* The newest release. What the plugin's update check compares against, and the
   default target of /api/download when no ?v= is given. */
export const LATEST = "1.1.0";

/* CURRENT_VERSION can pin /api/download's default to an older release — useful
   to roll back a bad release without a deploy. Unset means "serve LATEST",
   which is what you want almost always.

   NOTE: because this is an override, a stale CURRENT_VERSION left set to an old
   release in the dashboard will keep serving that release even after LATEST
   moves. Clear it or update it when you ship. */
export const CURRENT = (process.env.CURRENT_VERSION || "").trim() || LATEST;

/* Every download variable this app reads, so api/health.js can report on the
   real set instead of keeping its own hand-maintained copy. */
export const RELEASE_ENV_VARS = ["DOWNLOAD_URL_1_0_0", "DOWNLOAD_URL_1_1_0"];

/* Configured storage URL for a version, or "" when that version is unknown or
   has no storage set. Callers treat "" as "no download available" — telling a
   customer a release exists with no way to fetch it is worse than a clean 404. */
export function releaseUrl(version) {
  return RELEASES[version] || "";
}

/* Versions that are actually downloadable right now. A version present in
   RELEASES but with an unset variable is deliberately excluded. */
export function availableVersions() {
  return Object.keys(RELEASES).filter((version) => RELEASES[version]);
}
