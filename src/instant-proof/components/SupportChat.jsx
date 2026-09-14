/*
 * The support chat box.
 *
 * A panel for questions about InDesign automation, data merge and Microsoft
 * Publisher projects. It sends by text message to the studio's number (see
 * src/support.js): Send opens the visitor's own messaging app with their topic
 * and message filled in, and the conversation carries on there. The panel says
 * so before anyone types, so nobody expects a reply to appear inside the page.
 *
 * ── Where it opens from ──
 *
 * A round button in the bottom corner on a desktop. On a phone the corner is
 * taken — the tool's action bar is pinned there — so the phone bar carries a
 * "Chat" button beside Menu instead, and the panel rises as a sheet.
 *
 * ── Accessibility ──
 *
 * A non-modal dialog: the page behind stays usable. Opening moves focus to the
 * message box; Escape or Close returns focus to whatever opened it.
 */

import { useEffect, useId, useRef, useState } from "react";

import { SUPPORT_PHONE, SUPPORT_TOPICS, smsHref, telHref } from "../../support.js";
import { ChatIcon, CloseIcon } from "./Icons.jsx";

export default function SupportChat({ open, onClose, returnFocus }) {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const messageBox = useRef(null);
  const titleId = useId();
  const noteId = useId();

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

  /* A computer without texting can still reach the studio: copy the number. */
  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE.display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard refused (an insecure context or a denied permission). The
         number is on screen, so there is nothing else to do. */
    }
  };

  if (!open) return null;

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
          <span className="ip-chat-sub">Replies by text from Pressmark Studio</span>
        </span>
        <button type="button" className="ip-chat-close" aria-label="Close chat" onClick={close}>
          <CloseIcon />
        </button>
      </header>

      <div className="ip-chat-body">
        <p className="ip-chat-bubble">
          Hi — working on an InDesign automation, data merge or Microsoft Publisher project? Tell us
          what you need and we&rsquo;ll text you back.
        </p>

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

        <label className="ip-sr-only" htmlFor={`${titleId}-message`}>
          Your message
        </label>
        <textarea
          id={`${titleId}-message`}
          ref={messageBox}
          className="ip-chat-input"
          rows={4}
          placeholder="Describe your project…"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-describedby={noteId}
        />

        {/* A link, not a script: the sms: address is handed to the device's own
            messaging app, which is the part that actually sends. */}
        <a
          className="ip-btn ip-chat-send"
          href={smsHref({ topic, message })}
          aria-disabled={message.trim() ? undefined : true}
          onClick={(event) => {
            if (!message.trim()) event.preventDefault();
          }}
        >
          Send as text message
        </a>

        <p className="ip-chat-note" id={noteId}>
          Opens your messaging app with this message addressed to {SUPPORT_PHONE.display}. On a
          computer without texting, call or text that number from your phone.
        </p>

        <div className="ip-chat-alt">
          <a className="ip-btn" href={telHref()}>
            Call {SUPPORT_PHONE.display}
          </a>
          <button type="button" className="ip-btn" onClick={copyNumber}>
            {copied ? "Copied" : "Copy number"}
          </button>
        </div>
      </div>
    </section>
  );
}
