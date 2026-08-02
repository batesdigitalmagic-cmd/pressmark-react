/*
 * Obtains a fresh Zoho refresh token and writes it into .env.
 *
 *   npm run token
 *   npm run token -- --port=9000
 *
 * Runs a throwaway callback server on localhost, opens Zoho's consent screen,
 * catches the code, exchanges it, and rewrites only the ZOHO_REFRESH_TOKEN
 * line in .env. Every other line is preserved byte for byte, and .env is
 * backed up first.
 *
 * ONE-TIME SETUP: register the printed redirect URI in the Zoho API Console
 * (Server-based Application → Redirect URIs). It must match exactly.
 */

import http from "node:http";
import { exec } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { DEFAULT_SCOPES } from "../api/auth/zoho/start.js";

const ENV_PATH = new URL("../.env", import.meta.url).pathname;
const ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1]) || 8123;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

if (!existsSync(ENV_PATH)) {
  console.log(`\n${c.red(".env not found.")} Copy .env.example to .env and fill in your client id/secret.\n`);
  process.exit(1);
}
for (const key of ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET"]) {
  if (!process.env[key]) {
    console.log(`\n${c.red(`${key} is not set in .env.`)}\n`);
    process.exit(1);
  }
}

/* Replaces the value in place, or appends if the key is absent. Only the
   matched line is rewritten — comments, spacing, and every other key survive. */
function writeEnvValue(key, value) {
  const original = readFileSync(ENV_PATH, "utf8");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");

  const updated = pattern.test(original)
    ? original.replace(pattern, line)
    : `${original.replace(/\n*$/, "")}\n${line}\n`;

  const backup = `${ENV_PATH}.backup-${Date.now()}`;
  copyFileSync(ENV_PATH, backup);
  writeFileSync(ENV_PATH, updated, "utf8");
  return backup;
}

const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
const authUrl = `${ACCOUNTS_DOMAIN}/oauth/v2/auth?${new URLSearchParams({
  response_type: "code",
  client_id: process.env.ZOHO_CLIENT_ID,
  scope: process.env.ZOHO_SCOPES || DEFAULT_SCOPES,
  redirect_uri: REDIRECT_URI,
  state,
  access_type: "offline",
  prompt: "consent",
})}`;

console.log(`\n${c.bold("Zoho refresh token")}`);
console.log(c.dim(`scopes   ${process.env.ZOHO_SCOPES || DEFAULT_SCOPES}`));
console.log(`redirect ${c.yellow(REDIRECT_URI)}`);
console.log(c.dim("         ^ this must be registered in the Zoho API Console\n"));

function page(title, message, tone) {
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="margin:0;padding:64px 24px;font:16px/1.6 Inter,Arial,sans-serif;background:#fff;text-align:center;">
<div style="max-width:460px;margin:0 auto;">
<div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#aa7d48;font-weight:700;">Pressmark Studio</div>
<h1 style="font-family:Georgia,serif;font-size:26px;color:${tone};margin:18px 0 10px;">${title}</h1>
<p style="color:#4b5563;">${message}</p></div></body>`;
}

const result = await new Promise((resolve) => {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== "/callback") {
      res.writeHead(404).end();
      return;
    }

    const send = (html, status = 200) => {
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    };

    const error = url.searchParams.get("error");
    if (error) {
      send(page("Authorization failed", error, "#b3261e"), 400);
      server.close();
      return resolve({ error });
    }

    if (url.searchParams.get("state") !== state) {
      send(page("State mismatch", "The request was rejected.", "#b3261e"), 400);
      server.close();
      return resolve({ error: "state mismatch" });
    }

    const code = url.searchParams.get("code");
    if (!code) {
      send(page("No code returned", "Zoho did not include an authorization code.", "#b3261e"), 400);
      server.close();
      return resolve({ error: "no code" });
    }

    // Zoho reports the account's data center here for non-.com orgs.
    const accountsServer = url.searchParams.get("accounts-server") || ACCOUNTS_DOMAIN;

    try {
      const response = await fetch(`${accountsServer}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: process.env.ZOHO_CLIENT_ID,
          client_secret: process.env.ZOHO_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
        }).toString(),
      });
      const body = await response.json();

      if (body.error || !body.refresh_token) {
        send(page("Exchange failed", body.error || "No refresh token returned.", "#b3261e"), 400);
        server.close();
        return resolve({ error: body.error || "no refresh_token", body });
      }

      send(page("Connected", "Your refresh token has been written to .env. You can close this tab.", "#020814"));
      server.close();
      return resolve({ body, accountsServer });
    } catch (err) {
      send(page("Exchange failed", err.message, "#b3261e"), 500);
      server.close();
      return resolve({ error: err.message });
    }
  });

  server.listen(PORT, () => {
    console.log(c.dim("Opening your browser… approve the consent screen.\n"));
    console.log(c.dim("If it doesn't open, paste this:\n"));
    console.log(authUrl + "\n");
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${opener} "${authUrl}"`, () => {});
  });
});

if (result.error) {
  console.log(`\n${c.red("✗ Failed:")} ${result.error}`);
  if (result.body) console.log(c.dim(JSON.stringify(result.body)));
  console.log(c.dim(`\nIf Zoho rejected the redirect URI, register ${REDIRECT_URI} in the API Console.\n`));
  process.exit(1);
}

const { refresh_token, api_domain, scope } = result.body;
const backup = writeEnvValue("ZOHO_REFRESH_TOKEN", refresh_token);

console.log(`${c.green("✓")} ZOHO_REFRESH_TOKEN written to .env ${c.dim(`(${refresh_token.slice(0, 12)}…)`)}`);
console.log(c.dim(`  backup: ${backup}`));
console.log(c.dim(`  scopes granted: ${scope || "not reported"}`));

const currentApiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
if (api_domain && api_domain !== currentApiDomain) {
  console.log(`\n${c.yellow("! ZOHO_API_DOMAIN mismatch")} — Zoho reports ${api_domain}, .env has ${currentApiDomain}`);
  console.log(c.dim("  Update it by hand; I don't change values you didn't ask me to."));
}

if (scope && !/WorkDrive/i.test(scope)) {
  console.log(`\n${c.red("! No WorkDrive scope was granted")} — folder and link calls will fail.`);
}

console.log(c.dim("\nNext: npm run diagnose:link\n"));
