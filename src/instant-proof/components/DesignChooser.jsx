/*
 * Step 1 — choose a design.
 *
 * Two cards, one of which cannot be chosen. A disabled card that still looks
 * like a card is the honest presentation: the design exists, it is being built,
 * and the customer can see what is coming without being able to queue a job no
 * renderer knows how to run.
 *
 * The unavailable card is a real <button> carrying aria-disabled rather than
 * `disabled`. A disabled button is skipped by the tab order entirely, so a
 * keyboard user would never hear that the second design exists — this way it is
 * reachable, announced as unavailable, and does nothing when pressed.
 */

import { DESIGNS } from "../designs.js";

/*
 * "text-based", "photo-led", "print-ready": a browser will break a line after
 * the hyphen, leaving half a word at the end of a line. Each hyphenated word is
 * kept on one line instead. A non-breaking hyphen character would do the same,
 * but News Gothic Std has no glyph for it.
 */
function keepHyphensTogether(text) {
  return text.split(/(\S+-\S+)/).map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="ip-nowrap">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export default function DesignChooser({ selectedId, onSelect }) {
  return (
    <div className="ip-designs" role="group" aria-label="Choose a design">
      {DESIGNS.map((design) => {
        const selected = design.id === selectedId;
        return (
          <button
            key={design.id}
            type="button"
            className="ip-design"
            aria-pressed={design.renderable ? selected : undefined}
            aria-disabled={design.renderable ? undefined : true}
            onClick={() => design.renderable && onSelect(design.id)}
          >
            <span className="ip-card-head">
              <span className="ip-design-title">{design.name}</span>
              <span className={design.renderable ? "ip-tag ip-tag-live" : "ip-tag"}>
                {design.status}
              </span>
            </span>
            {/* The thumbnail sits beside the description lines only, not the
                title, and stretches to exactly their height. */}
            <span className="ip-design-row">
              <span className="ip-design-thumb">
                <img src={design.thumbnail} alt="" />
              </span>
              <span className="ip-design-body">
                <span className="ip-design-desc">{keepHyphensTogether(design.description)}</span>
                {design.note && (
                  <span className="ip-design-desc">
                    <strong>{keepHyphensTogether(design.note.lead)}</strong>{" "}
                    {keepHyphensTogether(design.note.text)}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
