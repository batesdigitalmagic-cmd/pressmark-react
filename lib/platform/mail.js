/*
 * Transactional account email. Best-effort: a mail failure must never block
 * registration, so callers catch. Delivery goes through lib/email.js (Zoho Mail),
 * whose live behaviour is still unverified — see the Zoho memory note.
 */

import { sendMail as zohoSend } from "../email.js";

/* The test suite must never reach a real mail provider. */
const sendMail = (message) => (process.env.NODE_ENV === "test" ? Promise.resolve() : zohoSend(message));

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const siteUrl = () => (process.env.VITE_SITE_URL || "https://pressmark.studio").replace(/\/$/, "");

function shell(heading, body, link, linkLabel) {
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f6f5f2;font-family:Inter,Arial,sans-serif;">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e1da;">
<tr><td style="padding:32px 36px;"><p style="margin:0 0 20px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#460f21;font-weight:700;">Pressmark Studio</p>
<p style="margin:0 0 14px;font-size:18px;color:#020814;">${esc(heading)}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563;">${esc(body)}</p>
<p style="margin:0 0 24px;"><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;background:#460f21;color:#fff;text-decoration:none;font-size:14px;font-weight:600;">${esc(linkLabel)}</a></p>
<p style="margin:0;font-size:12px;color:#6b7280;">If you didn't request this, you can ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
}

export const verifyLink = (token) => `${siteUrl()}/app#/verify?token=${encodeURIComponent(token)}`;
export const resetLink = (token) => `${siteUrl()}/app#/reset?token=${encodeURIComponent(token)}`;

export function sendVerificationEmail(to, token) {
  return sendMail({
    toAddress: to,
    subject: "Verify your Pressmark Studio account",
    html: shell("Confirm your email", "Confirm this address to start submitting production jobs. The link is valid for 24 hours.", verifyLink(token), "Verify email"),
  });
}

export function sendResetEmail(to, token) {
  return sendMail({
    toAddress: to,
    subject: "Reset your Pressmark Studio password",
    html: shell("Reset your password", "Use the button below to choose a new password. The link is valid for one hour and works once.", resetLink(token), "Choose a new password"),
  });
}
