/*
 * The selected design, in the colours currently chosen.
 *
 * ── Drawn after the real render ──
 *
 * Two listings set the way the InDesign export sets them: the name and the
 * main phone in bold either side of a dotted leader, then Alt Ph#, Email,
 * Address and Family Members with bold labels, and the double rule under each
 * listing. The first two households of the sample directory fill it, so it
 * matches what "Load the sample .csv" renders.
 *
 * ── Where each colour lands ──
 *
 * Exactly where the template applies it, for Directory Classic:
 *
 *   PM_Background  the page ground
 *   PM_Text        every word
 *   PM_Primary     the double rule under each listing
 *
 * A key under the page names each one beside its current colour, so a change
 * in the controls above can be traced to the part of the page it moved.
 *
 * It is still a likeness drawn in the browser, and says so: the PDF itself is
 * typeset in InDesign, with the template's own fonts and spacing.
 *
 * The colours arrive as CSS custom properties, so the whole page recolours from
 * one place and SHELL_CSS keeps owning the layout.
 */

/* The first two households of public/samples/directory-classic-sample.csv. */
const SAMPLE = [
  {
    name: "Abbott, Maya",
    phone: "404-555-0101",
    alt: "404-555-0141",
    email: "maya.abbott@example.org mabbott@example.com",
    address: "1847 Willow Crest Drive, Northhaven, GA 30318",
    family: "Jordan Abbott, Elise Abbott",
  },
  {
    name: "Bennett, Caleb",
    phone: "407-555-0102",
    alt: "407-555-0142",
    email: "caleb.bennett@example.org cbennett@example.com",
    address: "912 Harbor Pine Lane, Lakeside, FL 32801",
    family: "Nora Bennett",
  },
];

export default function DesignPreviewCard({ design, colors, keys = [] }) {
  const uses = (key) => keys.includes(key);
  /* The key lists only what this design paints, in the order it reads. */
  const legend = [
    uses("backgroundColor") && { key: "backgroundColor", label: "Background" },
    uses("textColor") && { key: "textColor", label: "Text" },
    uses("primaryColor") && { key: "primaryColor", label: "Lines" },
  ].filter(Boolean);

  return (
    <figure style={{ margin: 0 }}>
      <div
        className="ip-preview"
        role="img"
        aria-label={`${design.name} listings in your colours: ${legend
          .map((item) => `${item.label.toLowerCase()} ${colors[item.key]}`)
          .join(", ")}.`}
        style={{
          "--proof-preview-primary": colors.primaryColor,
          "--proof-preview-text": colors.textColor,
          "--proof-preview-bg": colors.backgroundColor,
        }}
      >
        {SAMPLE.map((entry) => (
          <div className="ip-preview-listing" key={entry.name} aria-hidden="true">
            <p className="ip-preview-head">
              <span>{entry.name}</span>
              <span className="ip-preview-leader" />
              <span>{entry.phone}</span>
            </p>
            <p><b>Alt Ph#:</b> {entry.alt}</p>
            <p><b>Email:</b> {entry.email}</p>
            <p><b>Address:</b> {entry.address}</p>
            <p><b>Family Members:</b> <span className="ip-preview-family">{entry.family}</span></p>
            <div className="ip-preview-rule" />
          </div>
        ))}
      </div>

      <ul className="ip-preview-key">
        {legend.map((item) => (
          <li key={item.key}>
            <span className="ip-preview-chip" style={{ background: colors[item.key] }} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>

      <figcaption className="ip-note ip-muted ip-preview-note">
        A likeness of the {design.name} listing in your colours. The PDF is typeset in InDesign.
      </figcaption>
    </figure>
  );
}
