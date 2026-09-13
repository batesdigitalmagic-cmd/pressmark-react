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
            <span className="ip-design-thumb">
              <img src={design.thumbnail} alt="" />
            </span>
            <span className="ip-design-body">
              <span className="ip-card-head">
                <span className="ip-design-title">{design.name}</span>
                <span className={design.renderable ? "ip-tag ip-tag-live" : "ip-tag"}>
                  {design.status}
                </span>
              </span>
              <span className="ip-design-desc">{design.description}</span>
              {!design.renderable && (
                <span className="ip-design-desc">
                  <strong>Not yet available to generate.</strong> The layout and photo handling
                  are still in production.
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
