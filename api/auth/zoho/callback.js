/*
 * Step 2 of the Zoho authorization-code flow.
 *
 * Zoho redirects here with ?code=...&state=... after an admin consents. This
 * route validates state, exchanges the code, and prints the refresh token once
 * so it can be pasted into the environment. It never persists or logs it.
 *
 * Register this exact URL in the Zoho API Console as the redirect URI:
 *   https://<your-domain>/api/auth/zoho/callback
 *
 * Delete both routes (or unset ZOHO_SETUP_SECRET) once you hold the token.
 */

import { STATE_COOKIE, resolveRedirectUri } from "./start.js";

export const config = { runtime: "edge" };

const FALLBACK_ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";

/* Zoho echoes back an `accounts-server` for the account's data center. It is
   caller-supplied, so it is matched against a fixed allowlist before we POST
   the client secret to it — otherwise this route is an SSRF that leaks
   credentials to any host an attacker puts in the URL. */
const ALLOWED_ACCOUNTS_HOSTS = new Set([
  "accounts.zoho.com",
  "accounts.zoho.eu",
  "accounts.zoho.in",
  "accounts.zoho.com.au",
  "accounts.zoho.jp",
  "accounts.zoho.com.cn",
  "accounts.zoho.sa",
  "accounts.zohocloud.ca",
]);

function resolveAccountsDomain(candidate) {
  if (!candidate) return FALLBACK_ACCOUNTS_DOMAIN;
  try {
    const url = new URL(candidate);
    if (url.protocol === "https:" && ALLOWED_ACCOUNTS_HOSTS.has(url.hostname)) {
      return `https://${url.hostname}`;
    }
  } catch {
    // fall through to the configured default
  }
  return FALLBACK_ACCOUNTS_DOMAIN;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const CLEAR_STATE_COOKIE = `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth/zoho; Max-Age=0`;

function page(title, bodyHtml, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<style>
  body { margin:0; padding:2.5rem 1.25rem; background:#fff; color:#020814;
         font:16px/1.6 Inter, 'Helvetica Neue', Arial, sans-serif; }
  main { max-width:680px; margin:0 auto; }
  h1 { font-family:'Cormorant Garamond', Georgia, serif; font-size:2rem; margin:0 0 1rem; }
  h2 { font-size:.72rem; letter-spacing:.12em; text-transform:uppercase;
       color:#aa7d48; margin:2rem 0 .5rem; }
  p { color:#4b5563; }
  code, pre { font-family:ui-monospace, Consolas, monospace; }
  pre { background:#f6f5f2; border:1px solid rgba(170,125,72,.3); border-radius:4px;
        padding:1rem; overflow-x:auto; font-size:.85rem; color:#020814; }
  .warn { border-left:3px solid #b3261e; background:#fdf4f3; padding:.9rem 1rem;
          margin:1.5rem 0; color:#7a1d16; font-size:.9rem; }
</style>
</head>
<body><main>${bodyHtml}</main></body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": CLEAR_STATE_COOKIE,
    },
  });
}

function errorPage(heading, detail, status) {
  return page(
    "Zoho authorization failed",
    `<h1>${escapeHtml(heading)}</h1><p>${escapeHtml(detail)}</p>
     <p>Restart at <code>/api/auth/zoho/start?secret=…</code>.</p>`,
    status
  );
}

export default async function handler(request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const denied = params.get("error");
  if (denied) {
    return errorPage("Zoho returned an error", denied, 400);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return errorPage(
      "Incomplete callback",
      "Zoho did not include a code and state. Start the flow from /api/auth/zoho/start.",
      400
    );
  }

  const expectedState = readCookie(request, STATE_COOKIE);
  if (!expectedState || !timingSafeEqual(state, expectedState)) {
    return errorPage(
      "State mismatch",
      "The state did not match this browser's cookie, so the request was rejected. " +
        "This happens if the flow was started elsewhere, the cookie expired after 10 minutes, or the request was forged.",
      400
    );
  }

  const accountsDomain = resolveAccountsDomain(params.get("accounts-server"));
  const exchange = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.ZOHO_CLIENT_ID || "",
    client_secret: process.env.ZOHO_CLIENT_SECRET || "",
    // Must match the value sent at authorization exactly.
    redirect_uri: resolveRedirectUri(request),
  });

  let payload;
  try {
    const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: exchange.toString(),
    });
    payload = await response.json();
  } catch (error) {
    // Log the failure but never the response body — it may hold a token.
    console.error("Zoho token exchange request failed:", error?.message);
    return errorPage("Could not reach Zoho", "The token exchange request failed. Try again.", 502);
  }

  if (payload.error) {
    return errorPage("Token exchange rejected", payload.error, 400);
  }

  if (!payload.refresh_token) {
    return page(
      "No refresh token returned",
      `<h1>No refresh token returned</h1>
       <p>Zoho returned an access token but no refresh token. That happens when this
       client was already authorized. Re-run the flow — <code>start.js</code> sends
       <code>prompt=consent</code> and <code>access_type=offline</code>, which should force one —
       or revoke the existing token in the Zoho API Console and try again.</p>`,
      400
    );
  }

  const apiDomain = payload.api_domain || "https://www.zohoapis.com";

  return page(
    "Zoho connected",
    `<h1>Zoho connected</h1>
     <p>Copy these into your Vercel environment variables now. This token is shown
     once and is not stored or logged anywhere.</p>
     <h2>Environment</h2>
     <pre>ZOHO_REFRESH_TOKEN=${escapeHtml(payload.refresh_token)}
ZOHO_API_DOMAIN=${escapeHtml(apiDomain)}
ZOHO_ACCOUNTS_DOMAIN=${escapeHtml(accountsDomain)}</pre>
     <div class="warn">
       <strong>Close this tab when you're done.</strong> Anyone with this refresh token
       has standing access to your CRM and WorkDrive. Once it's saved, unset
       <code>ZOHO_SETUP_SECRET</code> or delete <code>api/auth/zoho/</code> to take these
       routes offline.
     </div>
     <h2>Scopes granted</h2>
     <pre>${escapeHtml(payload.scope || "Not reported by Zoho")}</pre>`
  );
}
