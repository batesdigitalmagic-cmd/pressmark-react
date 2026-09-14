/*
 * The workspace shell every page of the site sits in.
 *
 * ── Why a sidebar and not a top nav ──
 *
 * The homepage is a tool, not a document. A tool's navigation should be
 * permanently visible and permanently out of the way, and it should not consume
 * the vertical space the work needs. Below 900px there is no room for that, so
 * the same list becomes a drawer behind a compact bar.
 *
 * ── One stylesheet, injected once ──
 *
 * This is a multi-page Vite build: each route is its own HTML entry, so there
 * is exactly one shell on a page and nothing to deduplicate. The <style> tags
 * live here rather than in each page so a new page cannot forget them.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { NAV_GROUPS } from "../nav.js";
import SupportChat from "./SupportChat.jsx";
import { ChatIcon } from "./Icons.jsx";
import { PROOF_CSS, SHELL_CSS } from "../theme.css.js";
/*
 * Two cuts of the same mark.
 *
 * The stacked lockup carries its wordmark in the bottom 5% of its height, so it
 * needs room: at the 30px of a phone's top bar the words would be under two
 * pixels tall. The sidebar has the room and gets the lockup; the top bar gets
 * the mark on its own, which is what a mark is for.
 */
import logo from "../../assets/pressmark-studio-logo.svg";
import mark from "../../assets/pressmark-studio-mark.svg";

function NavList({ current, onNavigate }) {
  return (
    <nav className="ip-nav" aria-label="Pressmark Studio">
      {NAV_GROUPS.map((group) => (
        <div className="ip-nav-group" key={group[0].href}>
          {group.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="ip-nav-item"
              /* aria-current is the accessible half of the highlight; the CSS
                 selector reads the same attribute, so the two cannot drift. */
              aria-current={item.href === current ? "page" : undefined}
              onClick={onNavigate}
            >
              <span className="ip-nav-dot" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * @param {object} props
 * @param {string} props.current  The pathname of the page being rendered, so the
 *   sidebar can mark it. Passed in rather than read from `location` because each
 *   page already knows what it is, and a build-time value cannot go stale.
 */
export default function AppShell({ current = "/", children }) {
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const menuButton = useRef(null);
  /* Whichever chat button was pressed, so closing the panel returns focus to it. */
  const chatOpener = useRef(null);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const toggleChat = (event) => {
    chatOpener.current = event.currentTarget;
    setChatOpen((was) => !was);
  };
  const sidebar = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  /*
   * Escape closes the drawer and returns focus to the button that opened it.
   *
   * Without the focus move, closing leaves focus on an element that is now
   * off-screen, and the next Tab starts from somewhere the customer cannot see.
   */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  /* Opening moves focus into the drawer, so a keyboard or screen-reader user is
     taken to what just appeared rather than left behind it. */
  useEffect(() => {
    if (open) sidebar.current?.focus();
  }, [open]);

  /* The page behind a modal drawer must not scroll under it. */
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="ip-root">
      <style>{PROOF_CSS}</style>
      <style>{SHELL_CSS}</style>

      <a className="ip-skip" href="#workspace">
        Skip to the tool
      </a>

      <div className="ip-app">
        <header className="ip-topbar">
          <a className="ip-topbar-logo" href="/" aria-label="Pressmark Studio home">
            <img src={mark} alt="Pressmark Studio" />
          </a>
          <span className="ip-topbar-actions">
            <button
              type="button"
              className="ip-menu-btn"
              aria-expanded={chatOpen}
              onClick={toggleChat}
            >
              <ChatIcon />
              Chat
            </button>
          <button
            type="button"
            ref={menuButton}
            className="ip-menu-btn"
            aria-expanded={open}
            aria-controls="site-nav"
            onClick={() => setOpen((was) => !was)}
          >
            <span className="ip-menu-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            Menu
          </button>
          </span>
        </header>

        {open && (
          /* A button, not a div: dismissing the drawer by tapping away from it
             has to be reachable without a pointer. */
          <button type="button" className="ip-scrim" aria-label="Close the menu" onClick={close} />
        )}

        <aside
          id="site-nav"
          className="ip-sidebar"
          ref={sidebar}
          tabIndex={-1}
          data-open={open ? "true" : "false"}
        >
          <a className="ip-sidebar-logo" href="/" aria-label="Pressmark Studio home">
            <img src={logo} alt="Pressmark Studio" />
          </a>

          <NavList current={current} onNavigate={close} />

          <div className="ip-sidebar-foot">
            <p style={{ margin: 0 }}>Your uploaded files are processed privately.</p>
            <p style={{ margin: 0 }}>
              <a href="/privacy">Privacy</a>
            </p>
          </div>
        </aside>

        <main className="ip-workspace" id="workspace">
          <div className="ip-page">
            {children}

            <footer className="ip-shell-foot">
              <span>© {new Date().getFullYear()} Pressmark Studio</span>
              <a href="/how-it-works">How it works</a>
              <a href="/privacy">Privacy</a>
              <a href="/contact">Custom publications</a>
            </footer>
          </div>
        </main>
      </div>

      {/* Desktop only; the phone bar has its own Chat button. */}
      <button
        type="button"
        className="ip-chat-launcher"
        aria-expanded={chatOpen}
        aria-label={chatOpen ? "Close chat" : "Chat with us"}
        onClick={toggleChat}
      >
        <ChatIcon />
        <span>Chat with us</span>
      </button>
      <SupportChat open={chatOpen} onClose={closeChat} returnFocus={chatOpener} />
    </div>
  );
}
