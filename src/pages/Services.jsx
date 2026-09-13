/*
 * /services — what the studio does when a template is not the answer.
 *
 * Deliberately short. The homepage is the product; this page exists so someone
 * with a bigger publication can see that we make those too, and reach a price
 * in one click.
 */

import AppShell from "../instant-proof/components/AppShell.jsx";
import { SERVICES } from "../instant-proof/business.js";

export default function Services() {
  return (
    <AppShell current="/services">
      <p className="ip-crumb">Studio services</p>
      <h1 className="ip-h1">Publication design and automation</h1>
      <p className="ip-lead">
        The directory tool covers one publication, done one way. Everything below is designed to
        order for schools, churches, associations, nonprofits and government agencies.
      </p>

      <ul className="ip-list-plain" style={{ marginTop: "var(--proof-space-6)" }}>
        {SERVICES.map((service) => (
          <li className="ip-card" key={service.title}>
            <h2 className="ip-card-title">{service.title}</h2>
            <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-2)" }}>
              {service.description}
            </p>
          </li>
        ))}
      </ul>

      <section className="ip-prose" style={{ marginTop: "var(--proof-space-7)" }}>
        <h2>How a custom project runs</h2>
        <p>
          We gather the photos, records and copy; design a layout your readers can navigate; and
          deliver files prepared for the printer — bleed, trim, image resolution, packaging and
          export all checked before they leave.
        </p>
        <p>
          <a className="ip-btn ip-btn-primary ip-touch" href="/contact">
            Request a price
          </a>{" "}
          <a className="ip-btn ip-btn-ghost ip-touch" href="/pricing">
            See pricing
          </a>
        </p>
      </section>
    </AppShell>
  );
}
