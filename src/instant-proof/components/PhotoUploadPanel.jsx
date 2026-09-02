/*
 * Quick Photo Proof — the upload step.
 *
 * The one screen that matters. A visitor should arrive, tap once, and be
 * looking at their own photographs. Everything optional is behind a
 * disclosure or on a later step.
 *
 * ── The two inputs ──
 *
 * `capture="environment"` on the camera input is what makes a phone open the
 * camera directly rather than the photo library. It is a hint, not a
 * guarantee — a desktop browser ignores it and shows a file picker, which is
 * the correct fallback, so both controls stay useful everywhere. They are kept
 * as two separate inputs because one input cannot both capture and multi-select.
 *
 * ── Privacy ──
 *
 * Photographs are held as File objects in React state and shown through object
 * URLs. Nothing is uploaded, nothing is written to storage, and no filename is
 * logged — a filename is very often a person's name.
 */

import { useId, useRef, useState } from "react";
import { formatBytes } from "../models.js";
import { MAX_FILE_BYTES } from "../publications.js";
import { QUICK_PROOF_PHOTO_LIMIT } from "../photoProject.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.8A1 1 0 0 1 8.7 4.7h6.6a1 1 0 0 1 .9.5L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.8" r="3.4" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="1.6" />
      <path d="M3 16l5-4 4 3 3-2 6 4" />
      <circle cx="8.4" cy="9.4" r="1.4" />
    </svg>
  );
}

export default function PhotoUploadPanel({
  photos,
  onAdd,
  onRemove,
  selectedIds,
  onToggleSelected,
  error,
}) {
  const [rejections, setRejections] = useState([]);
  const [busy, setBusy] = useState(false);
  const cameraId = useId();
  const libraryId = useId();
  const liveRef = useRef(null);

  const overLimit = photos.length > QUICK_PROOF_PHOTO_LIMIT;
  const choosing = selectedIds.length > 0;

  const handleFiles = (fileList, { fromCamera = false } = {}) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length === 0) return;

    setBusy(true);
    const problems = [];
    const allowed = [];

    for (const file of incoming) {
      const ext = (/\.[a-z0-9]+$/i.exec(file.name) || [""])[0].toLowerCase();
      /* Trust the MIME type as well as the extension: iOS sometimes hands over
         a file with no extension at all. */
      const looksLikeImage = file.type.startsWith("image/");

      if (!PHOTO_EXTENSIONS.includes(ext) && !looksLikeImage) {
        problems.push(`${file.name} is not a JPG, PNG or WebP photograph.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        problems.push(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_FILE_BYTES)}.`);
        continue;
      }
      allowed.push(file);
    }

    setRejections(problems);
    if (allowed.length > 0) onAdd(allowed, { fromCamera });
    setBusy(false);
  };

  const uploadButton = ({ id, label, hint, icon, inputProps, fromCamera }) => (
    <>
      <label htmlFor={id} className="ip-upload-btn ip-touch" style={{ border: `1.5px solid ${PALETTE.border}`, background: PALETTE.paper, color: PALETTE.text }}>
        <span style={{ color: PALETTE.accent }}>{icon}</span>
        <span style={{ fontSize: "0.95rem", fontWeight: 800, letterSpacing: "0.01em" }}>{label}</span>
        <span style={{ fontSize: "0.72rem", color: PALETTE.textMuted, lineHeight: 1.35 }}>{hint}</span>
      </label>
      <input
        id={id}
        type="file"
        className="ip-sr-only"
        accept={PHOTO_ACCEPT}
        {...inputProps}
        onChange={(event) => {
          handleFiles(event.target.files, { fromCamera });
          /* Reset so re-picking the same photo fires change again. */
          event.target.value = "";
        }}
      />
    </>
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <div className="ip-upload-actions">
        {uploadButton({
          id: cameraId,
          label: "Take a Photo",
          hint: "Opens your camera",
          icon: <CameraIcon />,
          /* One at a time: a capture input cannot multi-select. */
          inputProps: { capture: "environment" },
          fromCamera: true,
        })}
        {uploadButton({
          id: libraryId,
          label: "Choose Photos",
          hint: "Pick several from your library",
          icon: <LibraryIcon />,
          inputProps: { multiple: true },
        })}
      </div>

      <p style={{ fontSize: "0.78rem", lineHeight: 1.55, color: PALETTE.textMuted, margin: 0 }}>
        JPG, PNG or WebP, up to {formatBytes(MAX_FILE_BYTES)} each. Your photographs stay in this
        browser — nothing is uploaded.
      </p>

      {rejections.length > 0 && (
        <div role="alert" style={{ ...IP.notice, borderLeftColor: "#b3261e" }}>
          <strong style={{ display: "block", color: "#b3261e", marginBottom: "0.35rem" }}>
            {rejections.length} file{rejections.length === 1 ? " was" : "s were"} not added
          </strong>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {rejections.map((message) => (
              <li key={message} style={{ fontSize: "0.82rem", lineHeight: 1.55 }}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Count and, when it matters, which photographs will actually appear. */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "0.7rem", flexWrap: "wrap" }}>
          <h3 style={{ fontFamily: FONT_STACK, fontSize: "1.15rem", fontWeight: 800, margin: 0, color: PALETTE.text }}>
            Your photographs
          </h3>
          <span ref={liveRef} aria-live="polite" style={{ fontSize: "0.8rem", color: PALETTE.textMuted }}>
            {busy
              ? "Adding photographs…"
              : photos.length === 0
                ? "None yet"
                : `${photos.length} added`}
          </span>
        </div>

        {overLimit && (
          <p style={{ ...IP.notice, margin: "0 0 0.9rem" }}>
            <strong style={{ color: PALETTE.text }}>
              A sample proof shows {QUICK_PROOF_PHOTO_LIMIT} photographs.
            </strong>{" "}
            {choosing
              ? `You have chosen ${selectedIds.length}. Tap a photograph to add or remove it from the sample.`
              : `We will use the first ${QUICK_PROOF_PHOTO_LIMIT}, in order. Tap any photograph to choose which ones appear instead.`}{" "}
            The complete publication would carry all {photos.length}.
          </p>
        )}

        {photos.length > 0 && (
          <ul className="ip-photo-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {photos.map((photo, index) => {
              const included = choosing
                ? selectedIds.includes(photo.id)
                : index < QUICK_PROOF_PHOTO_LIMIT;
              return (
                <li key={photo.id}>
                  <div className="ip-photo-tile" data-excluded={overLimit && !included}>
                    {/* Tapping the picture toggles inclusion, but only once
                        there are more photographs than the sample can hold —
                        otherwise it would be a control with no purpose. */}
                    {overLimit ? (
                      <button
                        type="button"
                        onClick={() => onToggleSelected(photo.id)}
                        aria-pressed={included}
                        style={{ display: "block", width: "100%", height: "100%", padding: 0, border: "none", background: "none", cursor: "pointer" }}
                      >
                        <img src={photo.previewUrl} alt="" />
                        <span className="ip-sr-only">
                          {included ? "Included in the sample" : "Not in the sample"} — photograph {index + 1}
                        </span>
                      </button>
                    ) : (
                      <img src={photo.previewUrl} alt="" />
                    )}

                    <button
                      type="button"
                      className="ip-photo-remove"
                      onClick={() => onRemove(photo.id)}
                      aria-label={`Remove photograph ${index + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <span role="alert" style={{ ...IP.error, marginTop: "0.8rem" }}>{error}</span>
        )}
      </div>
    </div>
  );
}
