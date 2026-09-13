/*
 * A button that opens a small panel beneath it.
 *
 * Both of the composer's hidden surfaces — the "+" menu and the colour panel —
 * are this. Written once because the fiddly half is not the panel, it is the
 * behaviour a keyboard and screen-reader user needs and that is easy to get
 * subtly wrong twice:
 *
 *   Escape closes it and puts focus back on the trigger
 *   a click anywhere else closes it
 *   the trigger reports its state with aria-expanded
 *   focus moves into the panel when it opens
 *
 * Deliberately NOT a <dialog> and not focus-trapped. These panels are small,
 * non-modal and sit inside the flow of a form; trapping focus in a colour
 * picker would be more surprising than helpful, and tabbing out of it closing
 * it is what people expect.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

export default function Popover({ label, title, className = "", children, align = "start" }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef(null);
  const panel = useRef(null);
  const wrap = useRef(null);

  /*
   * Two closers, deliberately.
   *
   * `close` touches no ref, which is what lets it be handed to the panel's
   * content during render — a closer that read `trigger.current` there would be
   * reading a ref mid-render, and React makes no promise about its value then.
   * Returning focus is only ever needed for Escape, which happens in an event
   * handler where reading the ref is correct.
   */
  const close = useCallback(() => setOpen(false), []);
  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeAndRefocus();
    };
    /* pointerdown, not click: a click listener fires after the button that was
       pressed has already acted, which reopened the panel it just closed. */
    const onDown = (event) => {
      if (!wrap.current?.contains(event.target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [close, closeAndRefocus, open]);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  return (
    <div className="ip-pop" ref={wrap}>
      <button
        type="button"
        ref={trigger}
        className={`ip-pop-trigger ${className}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={label}
        title={label}
        onClick={() => setOpen((was) => !was)}
      >
        {children.trigger}
      </button>

      {open && (
        <div
          id={panelId}
          className="ip-pop-panel"
          data-align={align}
          ref={panel}
          tabIndex={-1}
          role="group"
          aria-label={title ?? label}
        >
          {typeof children.panel === "function" ? children.panel({ close }) : children.panel}
        </div>
      )}
    </div>
  );
}
