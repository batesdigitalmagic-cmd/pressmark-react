/*
 * "Add organization details" — every field optional.
 *
 * This replaced a required six-field step that stood between a visitor and
 * their first look at a proof. Nothing in here is needed to render: with no
 * organization name the cover uses a neutral label, and with no colours the
 * template's own palette applies.
 *
 * Contact details are deliberately absent. Email is asked for once, at the
 * point a visitor asks for something that needs a reply.
 */

import { PUBLICATION_SIZES, PAGE_COUNT_RANGES, DEADLINE_WINDOWS } from "../publications.js";
import { ORGANIZATION_FALLBACK, formatBytes } from "../models.js";
import { ColorField, SelectField, TextField } from "./Fields.jsx";
import { IP, PALETTE, FONT_STACK } from "../styles.js";

export default function OrganizationDisclosure({
  organization,
  onOrganizationChange,
  visual,
  onVisualChange,
  onLogoAdd,
  onLogoRemove,
  onOpened,
}) {
  const setOrg = (field) => (value) => onOrganizationChange({ ...organization, [field]: value });
  const setVisual = (field) => (value) => onVisualChange({ ...visual, [field]: value });

  return (
    <details
      className="ip-disclosure"
      style={{ border: `1px solid ${PALETTE.hairline}`, borderRadius: 4, background: PALETTE.white, padding: "0.85rem 1rem" }}
      onToggle={(event) => {
        if (event.currentTarget.open) onOpened?.();
      }}
    >
      <summary>
        <span className="ip-disclosure-caret" aria-hidden="true" style={{ color: PALETTE.accent, fontSize: "0.8rem" }}>
          ▶
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: FONT_STACK, fontSize: "1.1rem", fontWeight: 800, color: PALETTE.text }}>
            Add organization details
          </span>
          <span style={{ display: "block", fontSize: "0.78rem", color: PALETTE.textMuted, lineHeight: 1.45 }}>
            Optional — open this to put your name, logo and colours on the sample.
          </span>
        </span>
      </summary>

      <div style={{ display: "grid", gap: "1.1rem", padding: "1.1rem 0 0.3rem" }}>
        <TextField
          id="org-name"
          label="Organization name"
          value={organization.organizationName}
          onChange={setOrg("organizationName")}
          placeholder={ORGANIZATION_FALLBACK}
          autoComplete="organization"
          hint={`Left blank, the cover reads "${ORGANIZATION_FALLBACK}".`}
        />

        <div style={IP.grid2}>
          <ColorField
            id="brand-primary"
            label="Primary colour"
            value={visual.primaryColor}
            onChange={setVisual("primaryColor")}
            hint="Cover panels, headings and dividers."
          />
          <ColorField
            id="brand-secondary"
            label="Secondary colour"
            value={visual.secondaryColor}
            onChange={setVisual("secondaryColor")}
            hint="Rules and supporting accents."
          />
        </div>

        <div>
          <span style={IP.label}>Logo</span>
          {visual.logo ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.7rem 0.85rem", border: `1px solid ${PALETTE.hairline}`, borderRadius: 4 }}>
              {visual.logo.previewUrl && (
                <img src={visual.logo.previewUrl} alt="" style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: PALETTE.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {visual.logo.name}
                </span>
                <span style={{ display: "block", fontSize: "0.73rem", color: PALETTE.textMuted }}>
                  {formatBytes(visual.logo.size)}
                </span>
              </span>
              <button
                type="button"
                className="ip-file-remove ip-touch"
                onClick={onLogoRemove}
                style={{ border: `1px solid ${PALETTE.hairline}`, background: "transparent", borderRadius: 2, padding: "0 0.8rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: PALETTE.textMuted, cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="logo-input" className="ip-btn-ghost ip-touch" style={{ ...IP.btnGhost, cursor: "pointer" }}>
                Choose logo file
              </label>
              <input
                id="logo-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                className="ip-sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onLogoAdd(file);
                  event.target.value = "";
                }}
              />
              <span style={IP.hint}>PNG, JPG or WebP. A transparent PNG reproduces best.</span>
            </>
          )}
        </div>

        <div style={IP.grid2}>
          <SelectField
            id="org-size"
            label="Publication size"
            value={organization.publicationSize}
            onChange={setOrg("publicationSize")}
            options={PUBLICATION_SIZES}
            placeholder="Not sure yet"
          />
          <SelectField
            id="org-pages"
            label="Estimated page count"
            value={organization.estimatedPageCount}
            onChange={setOrg("estimatedPageCount")}
            options={PAGE_COUNT_RANGES}
            placeholder="Not sure yet"
            hint="Only used to estimate the time our automation saves."
          />
        </div>

        <SelectField
          id="org-deadline"
          label="Approximate deadline"
          value={organization.deadline}
          onChange={setOrg("deadline")}
          options={DEADLINE_WINDOWS}
          placeholder="No fixed deadline yet"
        />
      </div>
    </details>
  );
}
