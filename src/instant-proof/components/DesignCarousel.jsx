/*
 * The design carousel.
 *
 * A horizontal swipe strip of cover thumbnails, snapping the chosen one toward
 * the centre, with the selected design's name and state beneath it.
 *
 * ── One control, announced once ──
 *
 * The strip is a single radiogroup and each slide is one radio. The name and
 * the "Selected" pill beneath are plain text reflecting that state, not
 * additional controls — so a screen reader hears the selection once, from the
 * radio, rather than three times from three widgets that could disagree.
 *
 * ── Keyboard ──
 *
 * Arrow keys move between designs and select as they go, which is the native
 * radiogroup behaviour people expect; Home and End jump to the ends. The
 * focused slide is scrolled into view, so keyboard users are never selecting
 * something off-screen.
 *
 * ── Size ──
 *
 * Thumbnails are 145px at an 8.5:11 cover ratio, so a little under three sit in
 * a 390px viewport — enough of the third to show that it scrolls. The full-size
 * artwork lives behind "Preview design", never on this screen.
 */

import { useEffect, useRef } from "react";
import { templatesForPublication } from "../templates/registry.js";

export default function DesignCarousel({ publicationTypeId, value, onChange, onPreview }) {
  const templates = templatesForPublication(publicationTypeId);
  const stripRef = useRef(null);
  const slideRefs = useRef({});

  const selectedIndex = Math.max(templates.findIndex((t) => t.id === value), 0);
  const selected = templates[selectedIndex];

  /* Keep the chosen design in view when it changes from outside — a default
     being preselected, or the publication type changing the list. */
  useEffect(() => {
    const node = slideRefs.current[value];
    if (!node || !stripRef.current) return;
    node.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);

  const move = (delta) => {
    const next = templates[(selectedIndex + delta + templates.length) % templates.length];
    if (next) onChange(next.id);
  };

  const onKeyDown = (event) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        onChange(templates[0].id);
        break;
      case "End":
        event.preventDefault();
        onChange(templates[templates.length - 1].id);
        break;
      default:
        break;
    }
  };

  if (templates.length === 0) return null;

  return (
    <div>
      {templates.length > 1 && (
        <p className="ip-carousel-hint" aria-hidden="true">
          <span>←</span> Scroll <span>→</span>
        </p>
      )}

      <div
        ref={stripRef}
        className="ip-carousel"
        role="radiogroup"
        aria-label="Pressmark design"
        onKeyDown={onKeyDown}
      >
        {templates.map((template) => {
          const isSelected = template.id === value;
          return (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              /* Roving tabstop: one stop for the group, arrows move within it. */
              tabIndex={isSelected ? 0 : -1}
              ref={(node) => {
                slideRefs.current[template.id] = node;
              }}
              className="ip-slide"
              onClick={() => onChange(template.id)}
            >
              <span className="ip-slide-frame">
                <img
                  src={template.thumbnail}
                  alt=""
                  loading="lazy"
                  style={{ objectFit: template.id === "directory-classic" ? "contain" : "cover" }}
                />
              </span>
              {/* The only accessible name for the radio. */}
              <span className="ip-sr-only">{template.name}</span>
            </button>
          );
        })}
      </div>

      {/* Reflects the radiogroup rather than duplicating it. */}
      <p className="ip-design-name" aria-hidden="true">
        {selected?.name}
      </p>

      <p className="ip-design-state" aria-hidden="true">
        <span>✓</span> Selected
      </p>

      <p style={{ textAlign: "center", margin: 0 }}>
        <button type="button" className="ip-linkish" onClick={() => onPreview(selected)}>
          Preview design
          <span className="ip-sr-only"> — {selected?.name}</span>
        </button>
      </p>
    </div>
  );
}
