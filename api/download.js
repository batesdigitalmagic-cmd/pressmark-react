/*
 * A stable download URL on our own domain.
 *
 *   https://pressmark.studio/api/download          -> current version
 *   https://pressmark.studio/api/download?v=1.0.0  -> a specific version
 *
 * Why not link Zoho WorkDrive directly:
 *
 *   - Purchase emails are permanent. Someone opens theirs in eighteen months
 *     and clicks. If that pointed at WorkDrive and storage has since moved,
 *     it's dead. Pointing at our own domain means changing one env var.
 *   - The storage URL stays out of public view, so it can't be scraped off a
 *     forum post and hotlinked.
 *   - Download counts land in our own logs.
 *
 * This does NOT gate on a license, deliberately. The ZIP is inert without a
 * key; gating it only creates support tickets from people who legitimately
 * bought and cannot reach their file.
 */

export const config = { runtime: "edge" };

/* version -> direct download URL (must return the file, not a preview page).
   Keep old versions here; someone reinstalling an older build shouldn't have
   to email support. */
const RELEASES = {
  "1.0.0": process.env.DOWNLOAD_URL_1_0_0 || "",
};

const CURRENT = process.env.CURRENT_VERSION || "1.0.0";

export default async function handler(request) {
  const requested = new URL(request.url).searchParams.get("v") || CURRENT;
  const target = RELEASES[requested];

  if (!target) {
    return new Response(
      JSON.stringify({
        error: `No download available for version ${requested}.`,
        hint: "Check your purchase email, or contact support@pressmark.studio",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[download] ${requested} -> ${new URL(target).host}`);

  // 302, not 301. A permanent redirect gets cached by browsers and CDNs, and
  // then the target can never be changed.
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
}
