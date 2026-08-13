/*
 * A stable download URL on our own domain.
 *
 *   https://pressmark.studio/api/download          -> current version
 *   https://pressmark.studio/api/download?v=1.1.0  -> a specific version
 *   https://pressmark.studio/api/download?v=1.0.0  -> still resolves; old
 *                                                    purchase emails link here
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

/* Versions and their storage URLs live in lib/releases.js so this route and
   the plugin's update check can never disagree about what exists. */
import { CURRENT, releaseUrl } from "../lib/releases.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
  const requested = new URL(request.url).searchParams.get("v") || CURRENT;
  const target = releaseUrl(requested);

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
