/*
 * The support chat box.
 *
 * A real two-way chat for questions about InDesign automation, data merge and
 * Microsoft Publisher projects. What the visitor writes is sent by the server
 * to the studio's phone as a text; the studio texts back, and the reply appears
 * here. No phone number is shown or needed — see lib/chat/chat.js.
 *
 * ── Staying in touch with the reply ──
 *
 * The conversation id is kept in this browser, so the chat survives a reload
 * and follows the visitor around the site. While the panel is open it checks
 * for replies every few seconds, backing off when nothing arrives; while it is
 * closed it checks rarely, and a reply lights a dot on the chat button.
 *
 * ── Email mode ──
 *
 * Until texting is set up on the server, chat runs as a stand-in: the visitor
 * adds an email address, the message is emailed to the studio, and the reply
 * comes by email. The server says which mode it is in; the panel asks for the
 * address and words its promises to match, so nobody waits in the page for a
 * reply that will arrive in their inbox.
 *
 * ── When chat cannot deliver ──
 *
 * If the server can neither text nor email, the panel says chat is offline and
 * points to the price request form, rather than accepting a message that would
 * go nowhere.
 *
 * ── Accessibility ──
 *
 * A non-modal dialog. Opening moves focus to the message box; Escape or Close
 * returns focus to whatever opened it. New messages are announced politely.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CHAT_ENDPOINT, CHAT_STORAGE_KEY, MAX_MESSAGE_LENGTH, SUPPORT_TOPICS } from "../../support.js";
import { ChatIcon, CloseIcon } from "./Icons.jsx";

const OPEN_POLL_MS = 4000;
const OPEN_POLL_MAX_MS = 15000;
const CLOSED_POLL_MS = 60000;

/* localStorage can throw (private windows, blocked storage). The chat still
   works for the life of the page without it. */
const storage = {
  read() {
    try {
      return JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  },
  write(value) {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* Nothing to do; the conversation just will not survive a reload. */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      /* As above. */
    }
  },
};

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function SupportChat({ open, onClose, returnFocus, onUnread }) {
  const [conversationId, setConversationId] = useState(() => storage.read()?.id || "");
  const [messages, setMessages] = useState([]);
  const [available, setAvailable] = useState(null);
  const [mode, setMode] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const seen = useRef(storage.read()?.seen || 0);
  const messageBox = useRef(null);
  const thread = useRef(null);
  const titleId = useId();

  /* Whether chat can deliver at all, asked once. */
  useEffect(() => {
    let cancelled = false;
    fetch(CHAT_ENDPOINT, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        setAvailable(Boolean(body.available));
        setMode(body.mode || "");
      })
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!conversationId) return false;
    const response = await fetch(`${CHAT_ENDPOINT}?id=${conversationId}`, { cache: "no-store" });
    if (response.status === 404) {
      /* Expired after a week of quiet. Start fresh next time. */
      storage.clear();
      setConversationId("");
      setMessages([]);
      return false;
    }
    if (!response.ok) return false;
    const body = await response.json();
    let grew = false;
    setMessages((current) => {
      grew = body.messages.length !== current.length;
      return grew ? body.messages : current;
    });
    return grew;
  }, [conversationId]);

  /* Check for replies: often while open, rarely while closed. In email mode
     replies go to the visitor's inbox, so there is nothing to keep checking.*/
  useEffect(() => {
    if (!conversationId || !mode) return undefined;
    let cancelled = false;
    let timer;
    let delay = open ? OPEN_POLL_MS : CLOSED_POLL_MS;
    const tick = async () => {
      const grew = await refresh().catch(() => false);
      /* Email mode loads the conversation once, so a reload shows what was
         already said, and then stops. */
      if (cancelled || mode !== "sms") return;
      if (open) delay = grew ? OPEN_POLL_MS : Math.min(Math.round(delay * 1.3), OPEN_POLL_MAX_MS);
      timer = setTimeout(tick, delay);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conversationId, open, refresh, mode]);

  /* Unread: studio replies the visitor has not had the panel open for. */
  const studioCount = messages.filter((message) => message.from === "studio").length;
  useEffect(() => {
    if (open) {
      seen.current = studioCount;
      if (conversationId) storage.write({ id: conversationId, seen: studioCount });
    }
    onUnread?.(!open && studioCount > seen.current);
  }, [open, studioCount, conversationId, onUnread]);

  /* Keep the newest message in view. */
  useEffect(() => {
    if (open && thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    if (open) messageBox.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      onClose();
      returnFocus?.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, returnFocus]);

  const close = () => {
    onClose();
    returnFocus?.current?.focus();
  };

  const send = async () => {
    const text = draft.trim();
    if (mode === "email" && !conversationId && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return;
    if (!text || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: conversationId || undefined, topic, email: email || undefined, text }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 503) {
        setAvailable(false);
        return;
      }
      if (!response.ok) throw new Error(body.error || "The message could not be sent.");
      if (body.mode) setMode(body.mode);
      setConversationId(body.id);
      storage.write({ id: body.id, seen: seen.current });
      setMessages(body.messages);
      setDraft("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const started = messages.length > 0;
  const waiting = started && messages[messages.length - 1].from === "visitor";
  const byEmail = mode === "email";
  /* The address is asked for once, with the first message. */
  const needsEmail = byEmail && !conversationId;
  const emailOk = !needsEmail || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  return (
    <section className="ip-chat" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="ip-chat-head">
        <span className="ip-chat-avatar" aria-hidden="true">
          <ChatIcon />
        </span>
        <span className="ip-chat-heading">
          <span className="ip-chat-title" id={titleId}>
            Project support
          </span>
          <span className="ip-chat-sub">
            {available === false
              ? "Offline right now"
              : mode === "email"
                ? "We reply by email"
                : "Chat with Pressmark Studio"}
          </span>
        </span>
        <button type="button" className="ip-chat-close" aria-label="Close chat" onClick={close}>
          <CloseIcon />
        </button>
      </header>

      <div className="ip-chat-body">
        <div className="ip-chat-thread" ref={thread} aria-live="polite">
          <p className="ip-chat-bubble">
            Hi — working on an InDesign automation, data merge or Microsoft Publisher project? Tell
            us what you need and we&rsquo;ll {byEmail ? "reply by email" : "reply right here"}.
          </p>
          {messages.map((message, index) => (
            <p
              key={`${message.at}-${index}`}
              className={message.from === "visitor" ? "ip-chat-bubble ip-chat-mine" : "ip-chat-bubble"}
            >
              <span className="ip-sr-only">{message.from === "visitor" ? "You: " : "Pressmark Studio: "}</span>
              {message.text}
              <time className="ip-chat-time" dateTime={message.at}>
                {timeOf(message.at)}
              </time>
            </p>
          ))}
          {waiting && !byEmail && (
            <p className="ip-chat-note">
              Sent. We&rsquo;ll reply here — you can close this and keep browsing; the chat button
              shows a dot when we answer.
            </p>
          )}
          {waiting && byEmail && (
            <p className="ip-chat-note">
              Sent. We&rsquo;ll reply by email{email ? ` to ${email.trim()}` : ""}, usually within one
              business day. You can add more details here any time.
            </p>
          )}
        </div>

        {available === false ? (
          <p className="ip-chat-note">
            Chat is offline right now. <a href="/contact">Request a price</a> and we&rsquo;ll get back
            to you by email.
          </p>
        ) : (
          <>
            {!started && (
              <div className="ip-chat-topics" role="group" aria-label="What is it about?">
                {SUPPORT_TOPICS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="ip-chat-topic"
                    aria-pressed={topic === item}
                    onClick={() => setTopic((was) => (was === item ? "" : item))}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            <form
              className="ip-chat-compose"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              {needsEmail && (
                <>
                  <label className="ip-sr-only" htmlFor={`${titleId}-email`}>
                    Your email address
                  </label>
                  <input
                    id={`${titleId}-email`}
                    className="ip-chat-input ip-chat-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="Your email, so we can reply"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </>
              )}
              <label className="ip-sr-only" htmlFor={`${titleId}-message`}>
                Your message
              </label>
              <textarea
                id={`${titleId}-message`}
                ref={messageBox}
                className="ip-chat-input"
                rows={started ? 2 : 3}
                maxLength={MAX_MESSAGE_LENGTH}
                placeholder={started ? "Write a reply…" : "Describe your project…"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  /* Enter sends, Shift+Enter is a new line — as in any chat. */
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (emailOk) send();
                  }
                }}
              />
              <button
                type="submit"
                className="ip-btn ip-chat-send"
                disabled={!draft.trim() || !emailOk || sending || available === null}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>

            {error && (
              <p role="alert" className="ip-chat-note ip-chat-error">
                {error}
              </p>
            )}
            <p className="ip-chat-note">Messages are kept for 7 days.</p>
          </>
        )}
      </div>
    </section>
  );
}
