/*
 * Step 4 — sample content.
 *
 * The requested content is driven entirely by the publication configuration:
 * requiredContent and optionalContent produce the checklist, and the accepted
 * extensions come from the same objects. A yearbook asks for portraits and a
 * roster; an annual report asks for article copy and statistics. One component,
 * nine publication types.
 *
 * ── Privacy ──
 *
 * Nothing here transmits, persists or logs anything. Files are held as live
 * File objects in React state for the lifetime of the tab. Image previews use
 * object URLs, which are revoked on removal and on unmount so the blobs are
 * released. Filenames are rendered to the page (the visitor needs to see what
 * they added) but are never written to the console or to storage.
 *
 * PHASE 2: this panel gains a real transfer step. See docs/instant-proof.md —
 * the plan is signed, direct-to-storage PUT URLs with a 48-hour lifecycle rule,
 * requested per file from our API. This component's props do not change.
 */

import { useCallback, useId, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, MAX_FILES, MAX_FILE_BYTES } from "../publications.js";
import { formatBytes } from "../models.js";
import { IP, PALETTE, FONT_STACK } from "../styles.js";
import CsvTemplatePanel from "./CsvTemplatePanel.jsx";

const CSV_ONLY_EXTENSIONS = [".csv"];

function ContentChecklist({ items, heading, assets }) {
  if (items.length === 0) return null;

  /* A slot counts as satisfied when at least one added file carries an
     extension that slot accepts. Deliberately loose — we are guiding, not
     policing, and a customer who names things differently should not be
     blocked from continuing. */
  const satisfied = (item) => assets.some((asset) => item.accept.includes(asset.extension));

  return (
    <div>
      <h3
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: PALETTE.accent,
          margin: "0 0 0.7rem",
        }}
      >
        {heading}
      </h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
        {items.map((item) => {
          const done = satisfied(item);
          return (
            <li key={item.id} style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  marginTop: 2,
                  borderRadius: 2,
                  border: `1px solid ${done ? PALETTE.accent : PALETTE.hairline}`,
                  background: done ? PALETTE.accent : "transparent",
                  color: PALETTE.white,
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done ? "✓" : ""}
              </span>
              <span style={{ fontSize: "0.85rem", lineHeight: 1.55 }}>
                <span style={{ color: PALETTE.text, fontWeight: 600 }}>
                  {item.label}
                  {done && <span className="ip-sr-only"> — content added</span>}
                </span>
                <span style={{ color: PALETTE.textMuted }}> — {item.hint}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ProofUploadPanel({ config, assets, onAdd, onRemove, error, publicationTypeId, csvOnly = false }) {
  const [dragging, setDragging] = useState(false);
  const [rejections, setRejections] = useState([]);
  const dropId = useId();

  /* dragenter/dragleave fire for every child element. Counting them is the
     reliable way to know when the pointer has genuinely left the zone. */
  const dragDepth = useRef(0);

  const acceptedExtensions = csvOnly ? CSV_ONLY_EXTENSIONS : ACCEPTED_EXTENSIONS;
  const maximumBytes = csvOnly ? 2 * 1024 * 1024 : MAX_FILE_BYTES;
  const accept = acceptedExtensions.join(",");

  const handleFiles = useCallback(
    (fileList) => {
      const incoming = Array.from(fileList || []);
      if (incoming.length === 0) return;

      const problems = [];
      const allowed = [];

      for (const file of incoming) {
        const ext = (/\.[a-z0-9]+$/i.exec(file.name) || [""])[0].toLowerCase();

        if (!acceptedExtensions.includes(ext)) {
          problems.push(`${file.name} — ${ext || "no extension"} is not an accepted file type.`);
          continue;
        }
        if (file.size > maximumBytes) {
          problems.push(`${file.name} — ${formatBytes(file.size)} exceeds the ${formatBytes(maximumBytes)} limit.`);
          continue;
        }
        if (assets.length + allowed.length >= MAX_FILES) {
          problems.push(`${file.name} — the demo accepts ${MAX_FILES} files at a time.`);
          continue;
        }
        allowed.push(file);
      }

      setRejections(problems);
      if (allowed.length > 0) onAdd(allowed);
    },
    [acceptedExtensions, assets.length, maximumBytes, onAdd]
  );

  const onDrop = (event) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    handleFiles(event.dataTransfer?.files);
  };

  return (
    <div style={{ display: "grid", gap: "1.75rem" }}>
      <p style={{ ...IP.notice, fontFamily: FONT_STACK, fontSize: "0.98rem" }}>{config.uploadInstructions}</p>

      <div style={{ display: "grid", gap: "1.5rem" }}>
        <ContentChecklist heading="What we need" items={config.requiredContent} assets={assets} />
        <ContentChecklist heading="Helpful, but optional" items={config.optionalContent} assets={assets} />
      </div>

      <CsvTemplatePanel publicationTypeId={publicationTypeId} />

      {/* Drop zone. The visible control is the button/label pair; the drop
          behaviour is an enhancement for pointer users, never the only route. */}
      <div
        className="ip-drop"
        data-dragging={dragging}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <p style={{ fontFamily: FONT_STACK, fontSize: "1.2rem", fontWeight: 800, color: PALETTE.text, marginBottom: "0.4rem" }}>
          Drag your files here
        </p>
        <p style={{ fontSize: "0.85rem", color: PALETTE.textMuted, marginBottom: "1.1rem" }}>
          or choose them from your computer
        </p>

        <label htmlFor={dropId} className="ip-btn-primary" style={{ ...IP.btnPrimary, cursor: "pointer" }}>
          Select files
        </label>
        <input
          id={dropId}
            type="file"
          multiple
          accept={accept}
          className="ip-sr-only"
          aria-describedby={`${dropId}-types`}
          onChange={(event) => {
            handleFiles(event.target.files);
            /* Reset so re-selecting the same file fires change again. */
            event.target.value = "";
          }}
        />
        <p id={`${dropId}-types`} style={{ ...IP.hint, marginTop: "0.9rem" }}>
          {csvOnly ? "CSV only" : "JPG, JPEG, PNG, CSV, PDF and DOCX"}. Up to {MAX_FILES} files, {formatBytes(maximumBytes)} each.
        </p>
      </div>

      {rejections.length > 0 && (
        <div role="alert" style={{ ...IP.notice, borderLeftColor: "#b3261e" }}>
          <strong style={{ display: "block", color: "#b3261e", marginBottom: "0.4rem" }}>
            {rejections.length} file{rejections.length === 1 ? " was" : "s were"} not added
          </strong>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {rejections.map((message) => (
              <li key={message} style={{ fontSize: "0.82rem", lineHeight: 1.6 }}>
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* File list. aria-live so additions are announced without stealing focus. */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "0.7rem" }}>
          <h3 style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: PALETTE.accent, margin: 0 }}>
            Your files
          </h3>
          <span aria-live="polite" style={{ fontSize: "0.75rem", color: PALETTE.textMuted }}>
            {assets.length === 0
              ? "Nothing added yet"
              : `${assets.length} file${assets.length === 1 ? "" : "s"} · ${formatBytes(
                  assets.reduce((sum, asset) => sum + asset.size, 0)
                )}`}
          </span>
        </div>

        {assets.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
            {assets.map((asset) => (
              <li
                key={asset.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.85rem",
                  padding: "0.7rem 0.9rem",
                  border: `1px solid ${PALETTE.hairline}`,
                  borderRadius: 3,
                  background: PALETTE.white,
                }}
              >
                {asset.previewUrl ? (
                  <img
                    src={asset.previewUrl}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 2, flexShrink: 0, background: PALETTE.paper }}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 2,
                      background: PALETTE.paper,
                      border: `1px solid ${PALETTE.hairline}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.6rem",
                      fontWeight: 800,
                      color: PALETTE.textMuted,
                    }}
                  >
                    {asset.extension.replace(".", "").toUpperCase()}
                  </span>
                )}

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.87rem",
                      fontWeight: 600,
                      color: PALETTE.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {asset.name}
                  </span>
                  <span style={{ display: "block", fontSize: "0.74rem", color: PALETTE.textMuted }}>
                    {asset.extension.replace(".", "").toUpperCase()} · {formatBytes(asset.size)}
                  </span>
                </span>

                <button
                  type="button"
                  className="ip-file-remove"
                  onClick={() => onRemove(asset.id)}
                  style={{
                    flexShrink: 0,
                    border: `1px solid ${PALETTE.hairline}`,
                    background: "transparent",
                    borderRadius: 2,
                    padding: "0.4rem 0.75rem",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: PALETTE.textMuted,
                    cursor: "pointer",
                  }}
                >
                  Remove<span className="ip-sr-only"> {asset.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <span role="alert" style={{ ...IP.error, marginTop: "0.8rem" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
