/*
 * /directory-designs — the design library.
 *
 * Two entries today, and it says so. A library page that padded itself out with
 * designs that do not exist would be the same lie as a card a customer can
 * click and not receive.
 */

import AppShell from "../instant-proof/components/AppShell.jsx";
import { DESIGNS } from "../instant-proof/designs.js";

export default function DirectoryDesigns() {
  return (
    <AppShell current="/directory-designs">
      <p className="ip-crumb">Design library</p>
      <h1 className="ip-h1">Directory Designs</h1>
      <p className="ip-lead">
        Each design is a production InDesign template. Your spreadsheet is merged into it and
        exported as a print-ready PDF — the design is not a theme applied in a browser.
      </p>

      {/*
        * One design per row rather than two across.
        *
        * Each carries two real exports — a listing close enough to read and a
        * whole spread — and a preview you cannot read is not a preview. Side by
        * side in a two-column grid neither would be legible at any width worth
        * having.
        */}
      <div className="ip-list-plain" style={{ marginTop: "var(--proof-space-6)" }}>
        {DESIGNS.map((design) => (
          <article className="ip-card" key={design.id}>
            <div className="ip-card-head">
              <h2 className="ip-card-title">{design.name}</h2>
              <span className={design.renderable ? "ip-tag ip-tag-live" : "ip-tag"}>
                {design.status}
              </span>
            </div>
            <p className="ip-design-desc">{design.description}</p>

            <div className="ip-shots">
              {design.previews.map((preview) => (
                <figure className="ip-shot" key={preview.src}>
                  <img src={preview.src} alt={preview.alt} width="1400" height="713" loading="lazy" />
                  <figcaption>{preview.caption}</figcaption>
                </figure>
              ))}
            </div>
            {design.renderable ? (
              <p style={{ marginTop: "var(--proof-space-4)" }}>
                <a className="ip-btn ip-btn-primary ip-touch" href="/">
                  Create a PDF with this design
                </a>
              </p>
            ) : (
              <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-4)" }}>
                In production. The layout, the photo handling and the spreadsheet contract are
                still being built, so it cannot be generated yet.
              </p>
            )}
          </article>
        ))}
      </div>

      <section className="ip-prose" style={{ marginTop: "var(--proof-space-7)" }}>
        <h2>Need something that is not here?</h2>
        <p>
          Custom publications — yearbooks, annual reports, association directories, programs —
          are designed to order rather than generated.{" "}
          <a href="/contact">Tell us what you are making</a> and we will price it.
        </p>
      </section>
    </AppShell>
  );
}
