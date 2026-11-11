/*
 * Passwords and sessions for customer accounts.
 *
 * SERVER ONLY. Reads PLATFORM_SESSION_SECRET.
 *
 * Separate from lib/portal-session.js on purpose: that module proves control of
 * a purchase email for 30 minutes; this one is a long-lived login. Sharing a
 * secret would let a portal token be replayed as a login.
 *
 * Sessions are stateless HMAC-signed cookies carrying the user id and the
 * user's `sessionVersion`. Bumping the version (password change/reset, "sign out
 * everywhere") invalidates every cookie issued before it without a session table.
 */

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const COOKIE_NAME = "pm_session";
export const SESSION_SECONDS = 14 * 24 * 60 * 60;
export const MIN_PASSWORD_LENGTH = 10;

export function sessionSecretConfigured() {
  return (process.env.PLATFORM_SESSION_SECRET || "").length >= 32;
}

function secret() {
  const value = process.env.PLATFORM_SESSION_SECRET || "";
  if (value.length < 32) throw new Error("PLATFORM_SESSION_SECRET is not set (32+ characters).");
  return value;
}

const b64 = (buffer) => Buffer.from(buffer).toString("base64url");
const hmac = (data) => createHmac("sha256", secret()).update(data).digest();

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${b64(salt)}$${b64(derived)}`;
}

/* A real hash to compare against when the email is unknown, so "no such user"
   and "wrong password" take the same time. */
let decoyHash;
export async function verifyPassword(password, stored) {
  if (!stored) {
    decoyHash ??= await hashPassword("decoy-password-never-matches");
    await verifyPassword(password, decoyHash);
    return false;
  }
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scryptAsync(String(password), Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(expected, actual);
}

export function passwordProblem(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 200) return "That password is too long.";
  return "";
}

export function createSessionToken(user) {
  const payload = b64(
    JSON.stringify({ u: user.id, v: user.sessionVersion, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })
  );
  return `${payload}.${b64(hmac(payload))}`;
}

/** @returns {{userId: string, version: number}|null} */
export function readSessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = hmac(payload);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!decoded.exp || decoded.exp * 1000 < Date.now()) return null;
    return { userId: String(decoded.u), version: Number(decoded.v) };
  } catch {
    return null;
  }
}

export function cookieFrom(request) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return "";
}

const isSecure = (request) =>
  (request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "")) === "https";

export function sessionCookie(request, token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${isSecure(request) ? "; Secure" : ""}`;
}

export function clearedCookie(request) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecure(request) ? "; Secure" : ""}`;
}

/** One-time emailed tokens are stored hashed, so a store dump yields nothing usable. */
export const newOneTimeToken = () => randomBytes(32).toString("base64url");
export const hashOneTimeToken = (token) => b64(hmac(`ott:${token}`));

/*
 * CSRF. SameSite=Lax already stops cross-site POSTs carrying the cookie; this
 * additionally refuses a state-changing request whose Origin is another site.
 */
export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser client; has no ambient cookie to abuse
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
