/*
 * The support chat: conversations, and the bridge to the studio's phone.
 *
 * SERVER ONLY. Never import from src/.
 *
 * ── How a message travels ──
 *
 *   visitor types on the site
 *     → POST /api/chat/messages stores it and texts the studio's phone
 *       (Google Voice) from the site's Twilio number
 *   studio replies by text, from Google Voice, to that Twilio number
 *     → Twilio calls POST /api/chat/sms, which files the reply under the
 *       conversation it names
 *     → the visitor's chat, polling GET /api/chat/messages, shows it
 *
 * The studio's own number is only ever an environment variable. It is not in
 * the page, not in a response body and not in a log.
 *
 * ── Which conversation a reply belongs to ──
 *
 * Every conversation has a four-character code, shown in each text the studio
 * receives ("#K7Q2"). A reply that starts with a code goes to that
 * conversation. A reply without one goes to whichever conversation texted the
 * studio most recently — the natural thing when only one visitor is chatting,
 * and the code is there for when two are.
 *
 * ── Until texting is set up: email ──
 *
 * Texting needs a Twilio number, and a new number needs carrier registration
 * before it can send. Until the Twilio settings exist, chat runs in email mode:
 * the visitor also gives an email address, each message is emailed to the
 * studio's inbox through Zoho Mail (which the site already uses), and the studio
 * replies by email. Adding the Twilio settings switches every new message to
 * texting with no code change. See chatMode().
 *
 * ── Storage ──
 *
 * One JSON record per conversation in the same Redis the render jobs use,
 * expiring seven days after its last message. Messages are capped so a
 * conversation cannot grow without bound. Nothing a visitor writes is logged.
 */

import { randomBytes, randomInt } from "node:crypto";

import { SUPPORT_TOPICS } from "../../src/support.js";
import { command } from "../render-jobs/kv.js";

export const CHAT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_MESSAGE_LENGTH = 1000;
const MAX_MESSAGES = 200;
/* No 0/O, 1/I: the studio types these on a phone. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* Shared with the page, like the brand colours, so the two cannot disagree. */
export const TOPICS = SUPPORT_TOPICS;

const conversationKey = (id) => `chat:conversation:${id}`;
const codeKey = (code) => `chat:code:${code}`;
const LAST_KEY = "chat:last";

export const isConversationId = (value) => /^[a-f0-9]{48}$/.test(String(value || ""));

/** Whether texting is set up: the Twilio account, its number and the studio's phone. */
export function chatConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER &&
      process.env.PRESSMARK_CHAT_FORWARD_TO
  );
}

/** Whether the email fallback can send: the Zoho credentials /api/quote already uses. */
export function emailConfigured() {
  return Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN);
}

/** How messages reach the studio right now: "sms", "email", or null when neither can. */
export function chatMode() {
  if (chatConfigured()) return "sms";
  if (emailConfigured()) return "email";
  return null;
}

/* The inbox chat emails go to. */
export const studioInbox = () =>
  process.env.PRESSMARK_CHAT_EMAIL_TO || process.env.ZOHO_MAIL_FROM_ADDRESS || "quotes@pressmark.studio";

/* Deliberately simple: one @, something either side, a dot in the domain.
   The studio sees the address and replies to it, so a typo is caught there. */
export const isEmail = (value) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(String(value || "")) && String(value).length <= 254;

/** Digits only, with a leading 1 for a ten-digit US number, for comparing numbers. */
export const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
};

/** Printable text, trimmed and bounded. Control characters are dropped. */
export function cleanText(value) {
  return String(value ?? "")
    /* Stripping control characters is the point of this pattern. */
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

async function save(conversation) {
  await command([
    "SET",
    conversationKey(conversation.id),
    JSON.stringify(conversation),
    "EX",
    String(CHAT_TTL_SECONDS),
  ]);
  await command(["EXPIRE", codeKey(conversation.code), String(CHAT_TTL_SECONDS)]);
}

export async function readConversation(id) {
  if (!isConversationId(id)) return null;
  const raw = await command(["GET", conversationKey(id)]);
  return raw ? JSON.parse(raw) : null;
}

async function conversationByCode(code) {
  const id = await command(["GET", codeKey(String(code).toUpperCase())]);
  return id ? readConversation(id) : null;
}

export async function createConversation(topic, email = "") {
  const id = randomBytes(24).toString("hex");
  /* Claimed with NX so two conversations can never share a code. */
  let code = "";
  for (let attempt = 0; attempt < 20 && !code; attempt += 1) {
    const candidate = Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const claimed = await command(["SET", codeKey(candidate), id, "NX", "EX", String(CHAT_TTL_SECONDS)]);
    if (claimed) code = candidate;
  }
  if (!code) throw new Error("Could not allocate a chat code.");

  const now = new Date().toISOString();
  const conversation = {
    id,
    code,
    topic: TOPICS.includes(topic) ? topic : "",
    /* Email mode only. Kept on the server; never returned to the page. */
    email: isEmail(email) ? String(email).trim() : "",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await save(conversation);
  return conversation;
}

export async function appendMessage(conversation, from, text) {
  const message = { from, text, at: new Date().toISOString() };
  conversation.messages = [...conversation.messages, message].slice(-MAX_MESSAGES);
  conversation.updatedAt = message.at;
  await save(conversation);
  return message;
}

/** What the visitor's page is allowed to see: never the code's owner, never a number. */
export const publicConversation = (conversation) => ({
  id: conversation.id,
  messages: conversation.messages.map(({ from, text, at }) => ({ from, text, at })),
});

/*
 * The text the studio receives.
 *
 * The first message of a conversation says how to reply; after that the code
 * alone is enough, so a long chat is not a wall of repeated instructions.
 */
export function studioText(conversation, text) {
  const first = conversation.messages.filter((message) => message.from === "visitor").length === 1;
  const topic = conversation.topic ? ` (${conversation.topic})` : "";
  if (first) {
    return `Pressmark chat #${conversation.code}${topic}:\n${text}\n\nReply to answer. Start with ${conversation.code} if more than one chat is open.`;
  }
  return `#${conversation.code}: ${text}`;
}

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

/**
 * The email the studio receives in email mode: who wrote, about what, and the
 * whole conversation so far, with a one-click reply to the visitor.
 *
 * @returns {{subject: string, html: string}}
 */
export function studioEmail(conversation) {
  const topic = conversation.topic ? ` — ${conversation.topic}` : "";
  const latest = conversation.messages[conversation.messages.length - 1];
  const subject = `Website chat #${conversation.code}${topic}`;
  const replyHref = `mailto:${encodeURIComponent(conversation.email)}?subject=${encodeURIComponent(`Re: your Pressmark Studio chat${topic}`)}`;
  const history = conversation.messages
    .map(
      (message) =>
        `<p style="margin:0 0 12px;"><strong>${message.from === "visitor" ? "Visitor" : "Studio"}</strong> ` +
        `<span style="color:#6b7280;font-size:12px;">${escapeHtml(message.at)}</span><br>` +
        `${escapeHtml(message.text).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111418;font-size:15px;line-height:1.5;">
<p style="margin:0 0 4px;"><strong>New message from the website chat</strong>${escapeHtml(topic)}</p>
<p style="margin:0 0 16px;">From: <a href="${replyHref}">${escapeHtml(conversation.email)}</a></p>
<p style="margin:0 0 16px;padding:12px;background:#f8f9fa;border-radius:8px;">${escapeHtml(latest?.text).replace(/\n/g, "<br>")}</p>
<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Conversation so far</p>
${history}
<p style="margin:16px 0 0;"><a href="${replyHref}">Reply to the visitor by email</a></p>
</body></html>`;
  return { subject, html };
}

export async function rememberLast(conversation) {
  await command(["SET", LAST_KEY, conversation.id, "EX", String(CHAT_TTL_SECONDS)]);
}

/**
 * The conversation a studio reply belongs to, and the reply without its code.
 *
 * @returns {Promise<{conversation: object|null, text: string}>}
 */
export async function routeReply(body) {
  const match = /^\s*#?([A-Za-z2-9]{4})(?=$|[\s:,.-])[\s:,.-]*([\s\S]*)$/.exec(body);
  if (match) {
    const byCode = await conversationByCode(match[1]);
    if (byCode) return { conversation: byCode, text: cleanText(match[2]) };
  }
  const lastId = await command(["GET", LAST_KEY]);
  return { conversation: lastId ? await readConversation(lastId) : null, text: cleanText(body) };
}
