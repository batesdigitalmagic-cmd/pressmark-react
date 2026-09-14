/*
 * /api/chat/messages — the visitor's side of the support chat.
 *
 *   GET                    { available, mode }  whether chat can deliver, and how
 *   GET  ?id=<id>          { id, messages, available, mode }
 *   POST { id?, topic?, email?, text }  → { id, messages, mode }
 *
 * mode is "sms" (replies appear in the chat) or "email" (the stand-in until
 * texting is set up: the visitor gives an email address and is answered there).
 *
 * The 48-hex conversation id is the visitor's only capability over their chat;
 * the browser keeps it. A POST without one starts a new conversation.
 *
 * See lib/chat/chat.js for how a message reaches the studio and back.
 */

import {
  appendMessage,
  chatMode,
  cleanText,
  createConversation,
  isConversationId,
  isEmail,
  publicConversation,
  readConversation,
  rememberLast,
  studioEmail,
  studioInbox,
  studioText,
} from "../../lib/chat/chat.js";
import { sendSms } from "../../lib/chat/twilio.js";
import { sendMail } from "../../lib/email.js";
import { clientIp, rateLimit, tooManyRequests } from "../../lib/rate-limit.js";
import { json } from "../../lib/render-jobs/http.js";
import { kvConfigured } from "../../lib/render-jobs/kv.js";
import { toNodeHandler } from "../../lib/render-jobs/node-adapter.js";

/* Under the test suite, emails are collected here instead of sent. */
export const mailOutbox = [];
const deliverEmail = (message) =>
  process.env.NODE_ENV === "test" ? mailOutbox.push(message) : sendMail(message);

const UNAVAILABLE = { error: "Chat is offline right now.", available: false };

async function handler(request) {
  const mode = kvConfigured() ? chatMode() : null;
  const available = Boolean(mode);

  try {
    if (request.method === "GET") {
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return json({ available, mode });
      if (!kvConfigured()) return json(UNAVAILABLE, 503);
      /* Polled every few seconds by an open chat; generous, but bounded. */
      const limited = await rateLimit("chat-read", clientIp(request), { limit: 1200, windowSeconds: 3600 });
      if (!limited.ok) return tooManyRequests(limited.resetSeconds);
      const conversation = await readConversation(id);
      if (!conversation) return json({ error: "Conversation not found." }, 404);
      return json({ ...publicConversation(conversation), available, mode });
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!available) return json(UNAVAILABLE, 503);

    const limited = await rateLimit("chat-send", clientIp(request), { limit: 30, windowSeconds: 3600 });
    if (!limited.ok) return tooManyRequests(limited.resetSeconds);

    const body = await request.json().catch(() => ({}));
    const text = cleanText(body.text);
    if (!text) return json({ error: "Write a message first." }, 400);

    let conversation = null;
    if (body.id !== undefined && body.id !== null && body.id !== "") {
      if (!isConversationId(body.id)) return json({ error: "Conversation not found." }, 404);
      conversation = await readConversation(body.id);
    }
    /* Email mode needs somewhere to reply: the address given now, or the one the
       conversation already has. */
    const email = String(body.email || "").trim();
    if (mode === "email" && !conversation?.email && !isEmail(email)) {
      return json({ error: "Add your email address so we can reply." }, 400);
    }

    /* An expired conversation simply starts again rather than failing the send. */
    if (!conversation) conversation = await createConversation(body.topic, email);
    if (mode === "email" && !conversation.email) {
      conversation.email = email;
    }

    await appendMessage(conversation, "visitor", text);
    if (mode === "sms") {
      await rememberLast(conversation);
      await sendSms(process.env.PRESSMARK_CHAT_FORWARD_TO, studioText(conversation, text));
    } else {
      await deliverEmail({ toAddress: studioInbox(), ...studioEmail(conversation) });
    }

    return json({ ...publicConversation(conversation), mode }, 201);
  } catch (error) {
    /* The message only, never the visitor's text or a number. */
    console.error("[chat] messages failed:", error?.message || "unknown");
    return json({ error: "The message could not be sent. Try again in a moment." }, 500);
  }
}

export default toNodeHandler(handler);
