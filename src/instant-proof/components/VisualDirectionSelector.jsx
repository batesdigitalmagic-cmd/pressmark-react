/*
 * Step 3 — visual direction.
 *
 * Phase 2 replaced the four abstract style descriptions with real Pressmark
 * design templates: TemplateSelector renders the actual designs available for
 * the chosen publication type, and the style categories survive as filters
 * inside it. Everything else on this step — brand colors, logo, design notes —
 * is unchanged, and all three now feed the template renderer directly.
 *
 * The logo is held as an UploadedAsset like any other file — in memory only.
 */

import { useState } from "react";
import { IP, PALETTE, FONT_STACK } from "../styles.js";
import { ColorField, TextAreaField } from "./Fields.jsx";
import { formatBytes } from "../models.js";
import TemplateSelector from "./TemplateSelector.jsx";
import TemplatePreview from "./TemplatePreview.jsx";

export default function VisualDirectionSelector({
  value,
  onChange,
  onLogoAdd,
  onLogoRemove,
  errors,
  publicationTypeId,
  publicationLabel,
  organization,
}) {
  const set = (field) => (next) => onChange({ ...value, [field]: next });
  const [previewing, setPreviewing] = useState(null);

  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      <div>
        <span style={{ ...IP.label, marginBottom: "0.8rem" }} id="template-label">
          Pressmark design <span style={{ color: "#b3261e" }} aria-hidden="true">*</span>
        </span>
        <TemplateSelector
          publicationTypeId={publicationTypeId}
          value={value.templateId}
          onChange={(templateId) => onChange({ ...value, templateId })}
          onPreview={setPreviewing}
          error={errors.templateId}
        />
      </div>

      <div style={IP.grid2}>
        <ColorField
          id="brand-primary"
          label="Primary brand color"
          value={value.primaryColor}
          onChange={set("primaryColor")}
          hint="Drives cover panels, headings and section dividers in the template."
        />
        <ColorField
          id="brand-secondary"
          label="Secondary brand color"
          value={value.secondaryColor}
          onChange={set("secondaryColor")}
          hint="Drives rules, eyebrow type and supporting accents."
        />
      </div>

      <div>
        <span style={IP.label} id="logo-label">
          Logo
        </span>
        {value.logo ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "0.85rem 1rem",
              border: `1px solid ${PALETTE.hairline}`,
              borderRadius: 4,
              background: PALETTE.white,
            }}
          >
            {value.logo.previewUrl && (
              <img
                src={value.logo.previewUrl}
                alt=""
                style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  color: PALETTE.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {value.logo.name}
              </span>
              <span style={{ display: "block", fontSize: "0.75rem", color: PALETTE.textMuted }}>
                {value.logo.extension.replace(".", "").toUpperCase()} · {formatBytes(value.logo.size)}
              </span>
            </span>
            <button
              type="button"
              className="ip-file-remove"
              onClick={onLogoRemove}
              style={{
                border: `1px solid ${PALETTE.hairline}`,
                background: "transparent",
                borderRadius: 2,
                padding: "0.45rem 0.8rem",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: PALETTE.textMuted,
                cursor: "pointer",
              }}
            >
              Remove<span className="ip-sr-only"> logo {value.logo.name}</span>
            </button>
          </div>
        ) : (
          <div>
            <label
              htmlFor="logo-input"
              style={{ ...IP.btnGhost, display: "inline-block", cursor: "pointer" }}
              className="ip-btn-ghost"
            >
              Choose logo file
            </label>
            <input
              id="logo-input"
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="ip-sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onLogoAdd(file);
                event.target.value = "";
              }}
            />
            <span style={IP.hint}>PNG or JPG. A transparent PNG reproduces best.</span>
          </div>
        )}
      </div>

      <TextAreaField
        id="design-notes"
        label="Design notes"
        value={value.designNotes}
        onChange={set("designNotes")}
        rows={4}
        placeholder="Anything that should shape the design — school colors, a mascot, an existing brand guide, a publication you admire…"
        hint="Optional, but it makes the proof noticeably more relevant."
      />

      <p style={{ ...IP.notice, fontFamily: FONT_STACK, fontSize: "0.95rem" }}>
        These choices drive the sample directly. Your colors and logo are applied to the chosen
        template's cover and interior spreads, alongside your own records and photographs.
      </p>

      {previewing && (
        <TemplatePreview
          template={previewing}
          visual={value}
          organization={organization}
          publicationLabel={publicationLabel}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
