/*
 * Step 2 — Upload.
 *
 * One step, two shapes. Quick Photo Proof makes photographs the whole screen
 * and hides every optional field behind a disclosure. Spreadsheet mode keeps
 * the entire CSV pipeline — templates, column mapping, validation, filename
 * reconciliation — but presented compactly rather than as four full screens.
 *
 * Nothing here is a new engine. Every panel below already existed; this file
 * only decides which of them a visitor sees and in what order.
 */

import PhotoUploadPanel from "./PhotoUploadPanel.jsx";
import PhotoDetailsPanel from "./PhotoDetailsPanel.jsx";
import OrganizationDisclosure from "./OrganizationDisclosure.jsx";
import ProofUploadPanel from "./ProofUploadPanel.jsx";
import ColumnMappingPanel from "./ColumnMappingPanel.jsx";
import DataReviewPanel from "./DataReviewPanel.jsx";
import PhotoReconciliation from "./PhotoReconciliation.jsx";
import { ASSET_KINDS } from "../models.js";

function Disclosure({ label, hint, children, onOpened }) {
  return (
    <details
      className="ip-disclosure ip-section"
      style={{
        border: "1px solid var(--proof-line)",
        borderRadius: "var(--proof-radius)",
        background: "var(--proof-surface)",
        padding: "var(--proof-space-3) var(--proof-space-4)",
      }}
      onToggle={(event) => {
        if (event.currentTarget.open) onOpened?.();
      }}
    >
      <summary>
        <span className="ip-disclosure-caret" aria-hidden="true" style={{ color: "var(--proof-gold)" }}>
          ▶
        </span>
        <span>
          <span style={{ display: "block", fontFamily: "var(--proof-display)", fontWeight: 900, fontSize: "1.05rem", color: "var(--proof-ink)" }}>
            {label}
          </span>
          <span className="ip-note ip-muted" style={{ display: "block" }}>
            {hint}
          </span>
        </span>
      </summary>
      <div style={{ paddingTop: "var(--proof-space-4)" }}>{children}</div>
    </details>
  );
}

export default function UploadStep({
  project,
  inputMode,
  config,
  photos,
  matching,
  errors,
  onAddPhotos,
  onRemoveAsset,
  onToggleSelected,
  onPhotoDetails,
  onAddAssets,
  onOrganizationChange,
  onVisualChange,
  onLogoAdd,
  onLogoRemove,
  onConsentChange,
  onApplyProposals,
  onConfirmMapping,
  onReopenMapping,
  onPhotoOverride,
  onEvent,
}) {
  const photoMode = inputMode === "photos";

  const consent = (
    <label
      htmlFor="proof-consent"
      className="ip-section"
      style={{
        display: "flex",
        gap: "var(--proof-space-3)",
        alignItems: "flex-start",
        padding: "var(--proof-space-4)",
        border: `1.5px solid ${errors.consent ? "var(--proof-danger)" : "var(--proof-line)"}`,
        borderRadius: "var(--proof-radius)",
        background: "var(--proof-surface)",
        cursor: "pointer",
      }}
    >
      <input
        id="proof-consent"
        type="checkbox"
        checked={project.consentGranted}
        onChange={(event) => onConsentChange(event.target.checked)}
        aria-invalid={errors.consent ? "true" : undefined}
        style={{ width: 22, height: 22, marginTop: 1, flexShrink: 0, accentColor: "var(--proof-gold)", cursor: "pointer" }}
      />
      <span className="ip-note">
        I have permission to use this content, and I authorize Pressmark Studio to use it to produce
        this sample proof.
      </span>
    </label>
  );

  if (photoMode) {
    return (
      <div className="ip-page">
        <div className="ip-section-tight">
          <PhotoUploadPanel
            photos={photos}
            onAdd={onAddPhotos}
            onRemove={onRemoveAsset}
            selectedIds={project.selectedPhotoIds ?? []}
            onToggleSelected={onToggleSelected}
            error={errors.photos}
          />
        </div>

        {photos.length > 0 && (
          <>
            <Disclosure
              label="Add names or details"
              hint="Optional. A proof built from photographs alone is a perfectly good proof."
              onOpened={() => onEvent?.("details")}
            >
              <PhotoDetailsPanel photos={photos} onDetailsChange={onPhotoDetails} />
            </Disclosure>

            <OrganizationDisclosure
              organization={project.organization}
              onOrganizationChange={onOrganizationChange}
              visual={project.visual}
              onVisualChange={onVisualChange}
              onLogoAdd={onLogoAdd}
              onLogoRemove={onLogoRemove}
              onOpened={() => onEvent?.("organization")}
            />

            {consent}
            {errors.consent && (
              <p role="alert" className="ip-note" style={{ color: "var(--proof-danger)", marginTop: "var(--proof-space-2)" }}>
                {errors.consent}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  /* ── Spreadsheet mode ── */
  const parsed = project.data.records.length > 0;
  const csvMode = inputMode === "csv";

  return (
    <div className="ip-page">
      <div className="ip-section-tight">
        <ProofUploadPanel
          config={config}
          assets={project.assets}
          onAdd={onAddAssets}
          onRemove={onRemoveAsset}
          error={errors.assets}
          publicationTypeId={project.publicationTypeId}
          csvOnly={csvMode}
        />
      </div>

      {!csvMode && project.data.parseError && (
        <p role="alert" className="ip-note ip-section" style={{ color: "var(--proof-danger)" }}>
          {project.data.parseError}
        </p>
      )}

      {!csvMode && parsed && !project.data.mappingConfirmed && (
        <div className="ip-section">
          <ColumnMappingPanel
            schemaId={project.data.schemaId}
            proposals={project.data.proposals}
            sampleRows={project.data.rawRows.slice(0, 5)}
            onChange={onApplyProposals}
          />
          <button
            type="button"
            className="ip-btn ip-btn-gold"
            style={{ marginTop: "var(--proof-space-4)" }}
            onClick={onConfirmMapping}
          >
            Confirm these columns
          </button>
        </div>
      )}

      {!csvMode && parsed && project.data.mappingConfirmed && (
        <>
          <div className="ip-section">
            <DataReviewPanel data={project.data} matching={matching} />
          </div>
          <div className="ip-section">
            <PhotoReconciliation
              matching={matching}
              assets={project.assets.filter((asset) => asset.kind === ASSET_KINDS.image)}
              overrides={project.data.photoOverrides}
              onOverride={onPhotoOverride}
            />
          </div>
          <button
            type="button"
            className="ip-btn ip-btn-ghost"
            style={{ marginTop: "var(--proof-space-4)" }}
            onClick={onReopenMapping}
          >
            Change column mapping
          </button>
        </>
      )}

      {errors.data && (
        <p role="alert" className="ip-note ip-section" style={{ color: "var(--proof-danger)" }}>
          {errors.data}
        </p>
      )}

      {csvMode && (
        <div className="ip-section">
          <p className="ip-label">Supported spreadsheet headers</p>
          <p className="ip-note">Only <code>last_name</code> and <code>first_name</code> are required.</p>
          <ul className="ip-note" style={{ columns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {["last_name", "first_name", "address", "phone", "alternate_phone", "email", "alternate_email", "family_members"].map((header) => (
              <li key={header}><code>{header}</code></li>
            ))}
          </ul>
        </div>
      )}

      {csvMode && project.assets.some((asset) => asset.kind === ASSET_KINDS.data) && (
        <p className="ip-note ip-section">Your CSV will be validated and alphabetized securely after you choose Build My Free Proof.</p>
      )}

      {project.assets.length > 0 && (
        <>
          {consent}
          {errors.consent && (
            <p role="alert" className="ip-note" style={{ color: "var(--proof-danger)", marginTop: "var(--proof-space-2)" }}>
              {errors.consent}
            </p>
          )}
        </>
      )}
    </div>
  );
}
