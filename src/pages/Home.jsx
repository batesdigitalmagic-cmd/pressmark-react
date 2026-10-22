/*
 * / — the home page, written to the StoryBrand framework (Donald Miller).
 *
 * The visitor is the hero of the story, not Pressmark. Each section below is
 * one beat of the framework, in order, and the beat is named in a comment so
 * the next edit keeps the structure:
 *
 *   1. Character + want   — hero: who they are and the one thing they want
 *   2. Problem            — external (the work), internal (the dread),
 *                           philosophical (it shouldn't be this way)
 *   3. Guide              — empathy, then authority
 *   4. Plan               — three steps
 *   5. Call to action     — direct (buy / request a price), transitional (free tool)
 *   6. Failure            — what staying the same costs
 *   7. Success            — the picture of life after
 *
 * Only claims the studio can back are made here: no invented counts, clients
 * or testimonials. Prices come from the same constants the product pages use.
 */

import AppShell from "../instant-proof/components/AppShell.jsx";
import { PER_PAGE_RATE, SETUP_FEE_SMALL, money } from "../instant-proof/business.js";

const CSS = `
  .hm-hero { padding: var(--proof-space-4) 0 var(--proof-space-2); }
  .hm-hero .ip-h1 { max-width: 20ch; }
  .hm-photo { display: block; width: 100%; height: auto; margin-top: var(--proof-space-5); border-radius: 12px; aspect-ratio: 1586 / 992; object-fit: cover; background: var(--proof-ink); }
  .hm-cta { display: flex; flex-wrap: wrap; gap: var(--proof-space-3); margin-top: var(--proof-space-5); }
  .hm-sub { margin-top: var(--proof-space-3); }
  .hm-section { margin-top: var(--proof-space-7); }
  .hm-section > h2 { font-size: 1.45rem; margin: 0 0 var(--proof-space-3); color: var(--proof-ink); }
  .hm-grid { display: grid; gap: var(--proof-space-4); margin-top: var(--proof-space-4); }
  @media (min-width: 720px) { .hm-grid.hm-3 { grid-template-columns: repeat(3, 1fr); } .hm-grid.hm-2 { grid-template-columns: repeat(2, 1fr); } }
  .hm-grid .ip-card + .ip-card { margin-top: 0; }
  .hm-step-n { font-size: 0.8rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--proof-accent-deep); margin: 0 0 var(--proof-space-2); }
  .hm-price { font-weight: 600; color: var(--proof-ink); }
  .hm-card-actions { margin-top: var(--proof-space-4); display: flex; flex-wrap: wrap; gap: var(--proof-space-3); }
`;

const PROBLEMS = [
  {
    title: "The work",
    body: "Hundreds of portraits to cut out. Hundreds of names, grades and titles to place, one text box at a time.",
  },
  {
    title: "The feeling",
    body: "One late correction and you wonder what else slipped. The deadline gets closer while the pages stay the same.",
  },
  {
    title: "The principle",
    body: "A computer can place a name faster and more accurately than anyone. Making a publication shouldn't cost you your week.",
  },
];

const PLAN = [
  {
    title: "Send us your photos and spreadsheet",
    body: "Or run our scripts on them yourself. Either way the data stays the source of truth.",
  },
  {
    title: "We automate the repetitive work",
    body: "Photoshop scripts prepare every image; an InDesign data merge places every record and photo.",
  },
  {
    title: "You get print-ready pages",
    body: "Checked for bleed, trim and image resolution, and ready for any printer.",
  },
];

const PRODUCTS = [
  {
    name: "BatchCutout",
    price: "$10, one time",
    body: "Cut the background out of a whole folder of portraits in Photoshop, with eleven finishes from clean transparent PNGs to torn paper.",
    href: "/buy",
    cta: "Get BatchCutout",
  },
  {
    name: "Enhance + Cutout",
    price: "$19.99, one time",
    body: "Enhance every photo in a folder, then cut it out, in a single Photoshop run. Try it free on 10 photos.",
    href: "/enhance-cutout",
    cta: "Get Enhance + Cutout",
  },
];

export default function Home() {
  return (
    <AppShell current="/">
      <style>{CSS}</style>

      {/* 1. Character + want */}
      <section className="hm-hero">
        <p className="ip-crumb">Publication and design automation</p>
        <h1 className="ip-h1">Finish your publication without placing every photo by hand.</h1>
        <p className="ip-lead hm-sub">
          Yearbooks, directories and programs are made of hundreds of repeated, exacting
          tasks. Pressmark scripts and data merges do them for you, so the book is done
          sooner and is right the first time.
        </p>
        <div className="hm-cta">
          <a className="ip-btn ip-btn-primary ip-touch" href="/contact">
            Request a price
          </a>
          <a className="ip-btn ip-btn-ghost ip-touch" href="/buy">
            Get the Photoshop scripts
          </a>
        </div>
        {/* The "before": the problem the rest of the page offers to remove. */}
        <img
          className="hm-photo"
          src="/media/home-hero.jpg"
          width="1586"
          height="992"
          alt="A tired yearbook coordinator at a desk buried in stacks of printed student portraits, one hand on their forehead and the other raised in frustration."
          fetchPriority="high"
        />
      </section>

      {/* 2. Problem */}
      <section className="hm-section" aria-labelledby="hm-problem">
        <h2 id="hm-problem">Every publication has a deadline, and a pile of manual work.</h2>
        <div className="hm-grid hm-3">
          {PROBLEMS.map((item) => (
            <div className="ip-card" key={item.title}>
              <h3 className="ip-card-title">{item.title}</h3>
              <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-2)" }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Guide: empathy, then authority */}
      <section className="hm-section ip-prose" aria-labelledby="hm-guide">
        <h2 id="hm-guide">We know the late-night version of this job.</h2>
        <p>
          Pressmark Studio is a publication design studio. We build yearbooks, church and
          association directories, and program books, and we got tired of doing the
          repetitive parts by hand. So we automated them: Photoshop scripts for the
          photographs, and InDesign data merge for the pages.
        </p>
        <p>
          The same tools we use on client work are the ones we sell. You can buy the
          scripts, or hand us the whole book.
        </p>
      </section>

      {/* 4. Plan */}
      <section className="hm-section" aria-labelledby="hm-plan">
        <h2 id="hm-plan">Three steps from spreadsheet to print-ready.</h2>
        <div className="hm-grid hm-3">
          {PLAN.map((step, index) => (
            <div className="ip-card" key={step.title}>
              <p className="hm-step-n">Step {index + 1}</p>
              <h3 className="ip-card-title">{step.title}</h3>
              <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-2)" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Call to action: direct (scripts, custom work) */}
      <section className="hm-section" aria-labelledby="hm-scripts">
        <h2 id="hm-scripts">Do it yourself with our Photoshop scripts.</h2>
        <div className="hm-grid hm-2">
          {PRODUCTS.map((product) => (
            <div className="ip-card" key={product.name}>
              <h3 className="ip-card-title">{product.name}</h3>
              <p className="hm-price">{product.price}</p>
              <p className="ip-note ip-muted" style={{ marginTop: "var(--proof-space-2)" }}>
                {product.body}
              </p>
              <div className="hm-card-actions">
                <a className="ip-btn ip-btn-primary ip-touch" href={product.href}>
                  {product.cta}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="hm-section" aria-labelledby="hm-merge">
        <h2 id="hm-merge">Or have us run the data merge for you.</h2>
        <div className="ip-card" style={{ marginTop: "var(--proof-space-4)" }}>
          <p className="ip-note ip-muted">
            Portraits, names, grades, titles and custom fields, placed across hundreds of
            pages with accuracy and consistency. Custom publications start at{" "}
            {money(SETUP_FEE_SMALL)} setup plus {money(PER_PAGE_RATE)} per page.
          </p>
          <div className="hm-card-actions">
            <a className="ip-btn ip-btn-primary ip-touch" href="/contact">
              Request a price
            </a>
            <a className="ip-btn ip-btn-ghost ip-touch" href="/data-merge">
              How data merge works
            </a>
          </div>
        </div>
      </section>

      {/* 5b. Call to action: transitional (not ready to buy) */}
      <section className="hm-section ip-prose" aria-labelledby="hm-free">
        <h2 id="hm-free">Not ready to buy? Start free.</h2>
        <p>
          Make a directory PDF from your own spreadsheet in the browser, no account needed,
          or read the guides on getting a publication to print.
        </p>
        <p>
          <a className="ip-btn ip-btn-ghost ip-touch" href="/create-pdf">
            Create a free directory PDF
          </a>{" "}
          <a className="ip-btn ip-btn-ghost ip-touch" href="/blog">
            Read the guides
          </a>
        </p>
      </section>

      {/* 6. Failure */}
      <section className="hm-section ip-prose" aria-labelledby="hm-fail">
        <h2 id="hm-fail">What it costs to keep doing it by hand.</h2>
        <p>
          Missed deadlines. A misspelled name found after the books are printed. Evenings
          spent on copy and paste that no reader will ever notice, and a book that is
          harder to update next year.
        </p>
      </section>

      {/* 7. Success */}
      <section className="hm-section ip-prose" aria-labelledby="hm-win">
        <h2 id="hm-win">Picture the book finished.</h2>
        <p>
          The photos are cut out and consistent. Every name is on the right page, spelled
          the way your spreadsheet spells it. A correction is a change to one row, not a
          hunt through the layout. You send the PDF to the printer with time to spare.
        </p>
        <p>
          <a className="ip-btn ip-btn-primary ip-touch" href="/contact">
            Request a price
          </a>{" "}
          <a className="ip-btn ip-btn-ghost ip-touch" href="/buy">
            Get the scripts
          </a>
        </p>
      </section>
    </AppShell>
  );
}
