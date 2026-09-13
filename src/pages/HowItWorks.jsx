/*
 * /how-it-works — the four steps, in plain words.
 *
 * Not in the sidebar by design: it is a page for someone who wants to know what
 * happens before they start, and it is linked from the tool's own footer and
 * from the guides. The sidebar stays short.
 */

import AppShell from "../instant-proof/components/AppShell.jsx";

const STEPS = [
  {
    title: "Download the template",
    body: "A CSV with the correct heading row already in place. Starting from it is what makes the rest of this work: the headings are the merge fields the InDesign template expects, so there is nothing for you to map and nothing for us to guess.",
  },
  {
    title: "Fill it out",
    body: "One household per row, in Excel, Numbers or Google Sheets. Leave a cell empty where you do not have the information. Keep the heading row exactly as it is, then save as CSV.",
  },
  {
    title: "Upload and choose your colours",
    body: "We check the file in your browser before anything is sent, so a wrong column is caught immediately and named. Pick a primary and an accent colour, or keep ours.",
  },
  {
    title: "Receive your PDF",
    body: "Your directory is queued for a Mac running Adobe InDesign. It merges your records into the production template, exports a print-ready PDF, and the page hands you the download.",
  },
];

export default function HowItWorks() {
  return (
    <AppShell current="/how-it-works">
      <p className="ip-crumb">How it works</p>
      <h1 className="ip-h1">From spreadsheet to print-ready PDF</h1>
      <p className="ip-lead">
        Four steps, no account, no software to install, and no charge. The PDF is a genuine
        InDesign export, not a browser mock-up.
      </p>

      <ol className="ip-list-plain" style={{ marginTop: "var(--proof-space-6)" }}>
        {STEPS.map((step, index) => (
          <li className="ip-card" key={step.title}>
            <div className="ip-card-head">
              <h2 className="ip-card-title">
                {index + 1}. {step.title}
              </h2>
            </div>
            <p className="ip-note" style={{ marginTop: "var(--proof-space-2)" }}>{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="ip-prose" style={{ marginTop: "var(--proof-space-7)" }}>
        <h2>How long it takes</h2>
        <p>
          Checking your CSV is instant. The render itself depends on the queue: a directory
          waits until a production machine is free, and InDesign then takes a few minutes to set
          it. The page tells you which of those two you are waiting on rather than showing a
          progress bar that means nothing.
        </p>

        <h2>What happens to your file</h2>
        <p>
          Your CSV is held in private storage while the render runs and is deleted as soon as it
          succeeds. The finished PDF is reachable only from the private link on your download page
          and is removed after 48 hours. Nothing in your spreadsheet is logged.{" "}
          <a href="/privacy">Read the privacy notice</a>.
        </p>

        <h2>Start now</h2>
        <p>
          <a className="ip-btn ip-btn-primary ip-touch" href="/">
            Create a directory PDF
          </a>
        </p>
      </section>
    </AppShell>
  );
}
