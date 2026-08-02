/*
 * Step 1 of the Zoho authorization-code flow: send an admin to Zoho's consent
 * screen. The callback at /api/auth/zoho/callback finishes the exchange.
 *
 * This is a one-time setup route, not part of the customer-facing site. It is
 * gated behind ZOHO_SETUP_SECRET because completing this flow yields a refresh
 * token with standing access to your CRM and WorkDrive.
 *
 *   /api/auth/zoho/start?secret=<ZOHO_SETUP_SECRET>
 */

export const config = { runtime: "edge" };

const ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";

export const DEFAULT_SCOPES =
  "ZohoCRM.modules.leads.CREATE,WorkDrive.files.ALL,WorkDrive.links.ALL";

export const STATE_COOKIE = "zoho_oauth_state";

/* Both routes must derive an identical redirect_uri — Zoho compares it byte
   for byte at authorization and again at token exchange. */
export function resolveRedirectUri(request) {
  if (process.env.ZOHO_REDIRECT_URI) return process.env.ZOHO_REDIRECT_URI;
  return `${new URL(request.url).origin}/api/auth/zoho/callback`;
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default async function handler(request) {
  const setupSecret = process.env.ZOHO_SETUP_SECRET;

  // Fail closed: an unconfigured secret must not leave this route wide open.
  if (!setupSecret) {
    return new Response("Setup route disabled. Set ZOHO_SETUP_SECRET to enable it.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== setupSecret) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  }

  if (!process.env.ZOHO_CLIENT_ID) {
    return new Response("ZOHO_CLIENT_ID is not configured.", {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const state = randomState();
  const redirectUri = resolveRedirectUri(request);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOHO_CLIENT_ID,
    scope: process.env.ZOHO_SCOPES || DEFAULT_SCOPES,
    redirect_uri: redirectUri,
    state,
    // offline is what makes Zoho return a refresh token at all; consent forces
    // the prompt so a re-run still returns one instead of only an access token.
    access_type: "offline",
    prompt: "consent",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${ACCOUNTS_DOMAIN}/oauth/v2/auth?${params}`,
      // Lax survives the top-level GET redirect back from Zoho.
      "Set-Cookie": `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/zoho; Max-Age=600`,
      "Cache-Control": "no-store",
    },
  });
}
