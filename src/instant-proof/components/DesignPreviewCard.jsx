/*
 * The selected design, in the colours currently chosen.
 *
 * ── What this is honest about ──
 *
 * It is a browser sketch of where the two swatches land — a heading rule and a
 * masthead in the primary, the listing dividers in the accent — not a rendering
 * of the InDesign template. It is labelled as a preview for exactly that
 * reason. The typeset proof is the PDF, and nothing here should let a customer
 * believe this is what they will download.
 *
 * The colours arrive as CSS custom properties rather than inline styles on each
 * element, so the whole card recolours from one place and SHELL_CSS keeps
 * owning the layout.
 */

/* Two listings, not three. This sits inside a popover now, and the point it has
   to make — where the two colours land — is made by the second row. */
const SAMPLE = [
  { name: "Abernathy, David and Ruth", detail: "18 Chapel Lane · (555) 010-8842" },
  { name: "Castellanos, Miriam", detail: "204 Founders Way · (555) 010-3317" },
];

export default function DesignPreviewCard({ design, colors, keys = [] }) {
  const uses = (key) => keys.includes(key);
  /*
   * Rules are drawn in the accent where a design has one and in the text colour
   * where it does not — which is what Directory Classic's template actually
   * does, since its rules are Black. Painting them in an accent this design
   * never applies would show a publication that does not exist.
   */
  const rule = uses("accentColor") ? colors.accentColor : colors.textColor;
  return (
    <figure style={{ margin: 0 }}>
      <div
        className="ip-preview"
        /* Five of the six land somewhere visible here; the sixth, secondary,
           has no element of its own in this sketch and is left out rather than
           given a decorative one that means nothing. */
        style={{
          "--proof-preview-primary": colors.primaryColor,
          "--proof-preview-accent": rule,
          "--proof-preview-text": colors.textColor,
          "--proof-preview-bg": colors.backgroundColor,
          "--proof-preview-tint": colors.lightTint,
        }}
      >
        <div className="ip-preview-bar" />
        <div className="ip-preview-body">
          <p className="ip-preview-title">Member Directory</p>
          <p className="ip-preview-sub">{design.name}</p>
          {SAMPLE.map((entry) => (
            <div className="ip-preview-entry" key={entry.name}>
              <strong>{entry.name}</strong>
              <span>{entry.detail}</span>
            </div>
          ))}
          {/* The tint band only exists in designs that paint with it. */}
          {uses("lightTint") && <div className="ip-preview-rule" />}
        </div>
      </div>
      <figcaption className="ip-note ip-muted ip-preview-note">
        Where your colours land — not a rendering of the layout. The PDF is typeset in
        InDesign from the production template.
      </figcaption>
    </figure>
  );
}
