/*
 * Choosing a Pressmark design.
 *
 * Replaces Phase 1's four abstract style descriptions. A customer now picks a
 * real template with a thumbnail and a page list, because "Bold and Modern" is
 * a mood board and "Yearbook Modern, cover + portrait spread + feature spread"
 * is a decision they can actually make.
 *
 * Style categories survive as FILTER CHIPS, which is what they were always
 * good for. Everything renders from templatesForPublication(), so adding a
 * design to the registry adds a card here with no component change.
 *
 * ── Thumbnail sizing ──
 *
 * The preview is a THUMBNAIL, capped at 240px (180px on a phone) and centred in
 * its card — see .ip-template-thumb. It used to be `width: 100%` inside an
 * auto-fit grid, so with only two or three designs the tracks stretched and the
 * "thumbnail" rendered at ~350px, taking over the step. The cap is on the image
 * rather than the card, so the card can still breathe on a wide screen.
 *
 * The full-size look lives behind "Preview design", which opens the real pages
 * in a modal. That is the right place for something large.
 */

import { useMemo, useState } from "react";
import { templatesForPublication, styleCategoriesIn, pageTypesOf } from "../templates/registry.js";
import { STYLE_DIRECTIONS } from "../publications.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

const categoryLabel = (id) => STYLE_DIRECTIONS.find((style) => style.id === id)?.label ?? id;

const PAGE_TYPE_LABELS = {
  cover: "Cover",
  "listing-spread": "Listing spread",
  "profile-spread": "Profile spread",
  "portrait-spread": "Portrait spread",
  "feature-spread": "Feature spread",
};

export default function TemplateSelector({ publicationTypeId, value, onChange, onPreview, error }) {
  const templates = useMemo(
    () => templatesForPublication(publicationTypeId),
    [publicationTypeId]
  );
  const categories = useMemo(() => styleCategoriesIn(templates), [templates]);
  const [filter, setFilter] = useState("all");

  const visible = filter === "all" ? templates : templates.filter((t) => t.styleCategory === filter);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {categories.length > 1 && (
        <div>
          <span style={{ ...IP.label, marginBottom: "0.6rem" }} id="template-filter-label">
            Filter by feel
          </span>
          <div role="group" aria-labelledby="template-filter-label" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {["all", ...categories].map((category) => {
              const active = filter === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFilter(category)}
                  aria-pressed={active}
                  style={{
                    padding: "0.4rem 0.85rem",
                    borderRadius: 99,
                    border: `1px solid ${active ? PALETTE.accent : PALETTE.hairline}`,
                    background: active ? PALETTE.paper : PALETTE.white,
                    color: active ? PALETTE.accent : PALETTE.textMuted,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {category === "all" ? "All designs" : categoryLabel(category)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Pressmark design template"
        aria-describedby={error ? "template-error" : undefined}
        className="ip-template-grid"
      >
        {visible.map((template) => {
          const selected = value === template.id;
          return (
            <div
              key={template.id}
              className="ip-choice"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.8rem",
                cursor: "default",
                /* The radio inside carries the state; repeating aria-checked on
                   the wrapper would announce it twice. */
                borderColor: selected ? PALETTE.accent : undefined,
                background: selected ? PALETTE.paper : undefined,
                boxShadow: selected ? `inset 0 0 0 1px ${PALETTE.accent}` : undefined,
              }}
            >
              {/* The whole card body is the control, so the tap target stays
                  large even though the thumbnail no longer is. */}
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(template.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  color: "inherit",
                  display: "grid",
                  gap: "0.75rem",
                  textAlign: "center",
                  flex: 1,
                  alignContent: "start",
                }}
              >
                <span className="ip-template-thumb">
                  <img src={template.thumbnail} alt="" loading="lazy" />
                </span>

                <span style={{ display: "grid", gap: "0.4rem" }}>
                  <span
                    style={{
                      fontFamily: FONT_STACK,
                      fontSize: "1.15rem",
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: PALETTE.text,
                    }}
                  >
                    {template.name}
                  </span>
                  <span style={{ fontSize: "0.79rem", lineHeight: 1.55, color: PALETTE.textMuted }}>
                    {template.description}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: "0.28rem", justifyContent: "center", marginTop: "0.15rem" }}>
                    {pageTypesOf(template).map((pageType) => (
                      <span
                        key={pageType}
                        style={{
                          padding: "0.16rem 0.45rem",
                          borderRadius: 99,
                          border: `1px solid ${PALETTE.hairline}`,
                          background: PALETTE.white,
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          color: PALETTE.textMuted,
                        }}
                      >
                        {PAGE_TYPE_LABELS[pageType] ?? pageType}
                      </span>
                    ))}
                  </span>
                </span>

                {/* Reads as the Select control, and is what the radio state
                    renders as — one control, not two that could disagree. */}
                <span
                  className="ip-touch"
                  style={{
                    justifySelf: "center",
                    padding: "0 1.1rem",
                    borderRadius: 2,
                    border: `1px solid ${selected ? PALETTE.accent : PALETTE.border}`,
                    background: selected ? PALETTE.accent : "transparent",
                    color: selected ? "#000" : PALETTE.text,
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                  }}
                >
                  {selected ? "✓ Selected" : "Select"}
                </span>
              </button>

              <button
                type="button"
                className="ip-touch"
                onClick={() => onPreview(template)}
                style={{
                  padding: "0 0.9rem",
                  border: `1px solid ${PALETTE.hairline}`,
                  borderRadius: 2,
                  background: "transparent",
                  color: PALETTE.textMuted,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Preview design<span className="ip-sr-only"> — {template.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <span id="template-error" role="alert" style={IP.error}>
          {error}
        </span>
      )}
    </div>
  );
}
