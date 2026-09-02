/*
 * Optional per-photograph details.
 *
 * Every field here is optional and the panel says so plainly. The fields sit
 * behind a per-photograph disclosure so the screen reads as a wall of pictures
 * rather than a wall of inputs — a visitor who wants a purely visual proof
 * never opens one.
 *
 * Details are keyed to the asset id, so they follow their photograph when
 * others are removed or reordered.
 */

import { emptyPhotoDetails, hasPhotoDetails } from "../models.js";
import { QUICK_PROOF_PHOTO_LIMIT } from "../photoProject.js";
import { IP, PALETTE } from "../styles.js";

function DetailField({ id, label, value, onChange, placeholder, autoComplete = "off" }) {
  return (
    <div>
      <label htmlFor={id} style={{ ...IP.label, fontSize: "0.62rem", marginBottom: "0.3rem" }}>
        {label}
      </label>
      <input
        id={id}
        className="ip-input ip-touch"
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        style={{ ...IP.input, padding: "0.6rem 0.8rem", fontSize: "0.88rem" }}
      />
    </div>
  );
}

export default function PhotoDetailsPanel({ photos, onDetailsChange, onOpened }) {
  const shown = photos.slice(0, QUICK_PROOF_PHOTO_LIMIT);

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <p style={{ ...IP.notice, margin: 0 }}>
        <strong style={{ color: PALETTE.text }}>Names and titles are optional.</strong> You can
        generate a visual proof using only your photographs — anything you leave blank simply will
        not appear.
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.7rem" }}>
        {shown.map((photo, index) => {
          const details = photo.details ?? emptyPhotoDetails();
          const filled = hasPhotoDetails(details);
          const set = (key) => (value) => onDetailsChange(photo.id, { ...details, [key]: value });

          return (
            <li key={photo.id}>
              <details
                className="ip-disclosure"
                style={{
                  border: `1px solid ${filled ? PALETTE.accent : PALETTE.hairline}`,
                  borderRadius: 4,
                  background: PALETTE.white,
                  padding: "0.6rem 0.8rem",
                }}
                onToggle={(event) => {
                  if (event.currentTarget.open) onOpened?.();
                }}
              >
                <summary>
                  <span className="ip-disclosure-caret" aria-hidden="true" style={{ color: PALETTE.accent, fontSize: "0.8rem" }}>
                    ▶
                  </span>
                  <img
                    src={photo.previewUrl}
                    alt=""
                    style={{ width: 40, height: 50, objectFit: "cover", borderRadius: 3, flexShrink: 0, background: PALETTE.paper }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, color: PALETTE.text }}>
                      {details.displayName.trim() || `Photograph ${index + 1}`}
                    </span>
                    <span style={{ display: "block", fontSize: "0.72rem", color: filled ? PALETTE.accent : PALETTE.textMuted }}>
                      {filled ? "Details added — tap to edit" : "Add details"}
                    </span>
                  </span>
                </summary>

                <div
                  className="ip-detail-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "0.75rem",
                    padding: "0.85rem 0 0.35rem",
                  }}
                >
                  <DetailField id={`d-name-${photo.id}`} label="Display name" value={details.displayName} onChange={set("displayName")} placeholder="Ava Whitfield" autoComplete="name" />
                  <DetailField id={`d-title-${photo.id}`} label="Title or role" value={details.title} onChange={set("title")} placeholder="Board President" />
                  <DetailField id={`d-cat-${photo.id}`} label="Category" value={details.category} onChange={set("category")} placeholder="Board of Directors" />
                  <DetailField id={`d-cap-${photo.id}`} label="Short caption" value={details.caption} onChange={set("caption")} placeholder="Serving since 2019" />
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      {photos.length > shown.length && (
        <p style={{ fontSize: "0.8rem", lineHeight: 1.55, color: PALETTE.textMuted, margin: 0 }}>
          Showing details for the {shown.length} photographs in the sample. The rest would be
          included in the complete publication.
        </p>
      )}
    </div>
  );
}
