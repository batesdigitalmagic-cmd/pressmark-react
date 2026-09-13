/*
 * /pricing — the page rate, stated plainly.
 *
 * The old site had a slider that estimated a total as you dragged it. The same
 * arithmetic is here as a table: five realistic publications with their real
 * totals, which answers the question faster than a control the reader has to
 * operate. The numbers come from business.js, so the rate has one home.
 */

import AppShell from "../instant-proof/components/AppShell.jsx";
import {
  PER_PAGE_RATE,
  PRICING_EXAMPLES,
  SETUP_FEE,
  SETUP_FEE_SMALL,
  SMALL_BOOK_MAX_PAGES,
  estimateTotal,
  money,
  setupFeeFor,
} from "../instant-proof/business.js";

export default function Pricing() {
  return (
    <AppShell current="/pricing">
      <p className="ip-crumb">Pricing</p>
      <h1 className="ip-h1">What a publication costs</h1>
      <p className="ip-lead">
        A setup fee plus a flat rate per page. Trim size does not change the rate — a 5.5×8.5
        page and an 8.5×11 page cost the same.
      </p>

      <div className="ip-card" style={{ marginTop: "var(--proof-space-6)" }}>
        <h2 className="ip-card-title">The rate</h2>
        <ul className="ip-prose" style={{ marginTop: "var(--proof-space-3)" }}>
          <li>
            <strong>{money(SETUP_FEE_SMALL)} setup</strong> for publications under{" "}
            {SMALL_BOOK_MAX_PAGES} pages, <strong>{money(SETUP_FEE)}</strong> at or above it.
            Setup covers the CSV-driven data merge and the automation, which is lighter work on a
            short book.
          </li>
          <li>
            <strong>{money(PER_PAGE_RATE)} per page</strong> of designed publication.
          </li>
        </ul>
      </div>

      <div className="ip-card">
        <h2 className="ip-card-title">Worked examples</h2>
        <div style={{ overflowX: "auto", marginTop: "var(--proof-space-3)" }}>
          <table className="ip-table">
            <thead>
              <tr>
                <th scope="col">Publication</th>
                <th scope="col">Pages</th>
                <th scope="col">Setup</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {PRICING_EXAMPLES.map((example) => (
                <tr key={example.label}>
                  <th scope="row">{example.label}</th>
                  <td>{example.pages}</td>
                  <td>{money(setupFeeFor(example.pages))}</td>
                  <td>{money(estimateTotal(example.pages))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-3)" }}>
          Estimates for planning. Printing and shipping are priced separately by your printer.
        </p>
      </div>

      <section className="ip-prose" style={{ marginTop: "var(--proof-space-6)" }}>
        <h2>The directory tool is free</h2>
        <p>
          Creating a Directory Classic PDF on <a href="/">the homepage</a> is free, with no
          account and nothing held back. The pricing above is for custom publication work.
        </p>
        <p>
          <a className="ip-btn ip-btn-primary ip-touch" href="/contact">
            Request a price
          </a>
        </p>
      </section>
    </AppShell>
  );
}
