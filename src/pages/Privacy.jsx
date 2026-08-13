import { BLOG_RESPONSIVE_CSS, FONT_STACK, GLOBAL_CSS, PAGE_X, PALETTE, PROSE_W, S } from "../blog/theme.js";
import { SiteFooter, SiteHeader } from "../blog/components.jsx";

/*
 * /privacy
 *
 * Written to describe what this site actually does, not a generic template.
 * Every claim here is checkable against the code:
 *
 *   • Analytics genuinely does not load before consent  → src/analytics.js
 *   • Card details genuinely never reach us             → Stripe Checkout is hosted
 *   • Licence data is what the activation endpoints use → api/license/*
 *
 * If any of those change, this page has to change with them.
 */

const LAST_UPDATED = "August 12, 2026";
const CONTACT = "support@pressmark.studio";

const SECTIONS = [
  {
    heading: "Information We Collect",
    body: [
      "We collect what you choose to give us. That is mostly the information you type into a form or send us directly:",
    ],
    list: [
      "Your name and email address",
      "Details you submit through our contact or quote forms, such as your organization, publication type, page count, deadline, and budget",
      "Files and project material you send us, such as photographs, spreadsheets, and existing publication files",
      "Purchase-related information when you buy a product",
      "Support messages you send us",
    ],
    after: [
      "We do not buy personal information about you from third parties, and we do not build advertising profiles.",
    ],
  },
  {
    heading: "Payments",
    body: [
      "Purchases are processed by third-party payment providers, currently Stripe. When you buy something, you enter your card details on a page hosted by the payment provider, not on our site.",
      "We never receive or store your full card number, expiry date, or security code. What reaches us is limited to confirmation that a payment succeeded, the amount, the currency, and the email address you used at checkout.",
    ],
  },
  {
    heading: "Google Analytics",
    body: [
      "We use Google Analytics 4 to understand how the site is used — which pages people visit, where visitors come from, general device and browser information, how people move through the site, and whether a visit led to a purchase.",
      "Google Analytics does not load until you explicitly accept analytics using the consent banner. Before you choose, no analytics script is loaded and no request is made to Google. If you decline, analytics stays disabled and is never loaded on later visits.",
      "Because of this, our analytics deliberately does not count everyone. Visitors who decline are not measured at all, so our figures are an undercount rather than a complete picture. We think that is the right trade.",
      "We do not enable Google's advertising features, ad personalization, or cross-device tracking signals.",
    ],
  },
  {
    heading: "Cookies and Local Storage",
    body: ["The site uses browser storage for two different purposes, and it is worth separating them."],
    list: [
      "Necessary — remembering your analytics choice so we do not ask again, and keeping you signed in to the licence portal during a session. These are required for the site to work as you would expect and are not used for tracking.",
      "Optional analytics — cookies set by Google Analytics, and only after you accept. If you decline, these are never set.",
    ],
    after: [
      "You can clear this storage at any time through your browser settings. Clearing it will make the consent banner appear again.",
    ],
  },
  {
    heading: "Licensing and Digital Products",
    body: [
      "When you buy a digital product such as Pressmark BatchCutout, we process information needed to issue and manage your licence. That includes activating your licence, checking that it is valid, recognising which computers you have authorised, letting you release a computer you no longer use, telling the software when an update is available, and helping you when something goes wrong.",
      "It also lets us identify misuse — for example, a licence being shared far beyond the number of computers it covers.",
      "We keep this to what the licence needs to function. We do not use it to profile you or to market to you.",
    ],
  },
  {
    heading: "Purchase and Transaction Data",
    body: [
      "We keep limited records of purchases so that we can fulfil your order, support your licence, answer questions later, keep proper accounts, guard against fraudulent transactions, and meet our legal and tax obligations.",
    ],
  },
  {
    heading: "Third-Party Services",
    body: [
      "Running this business means relying on a small number of service providers. The ones that may handle your information are:",
    ],
    list: [
      "Stripe — payment processing",
      "Google Analytics — website usage measurement, only after you accept",
      "Vercel — website and application hosting",
      "Zoho — email, customer records, and secure file storage for project material you send us",
    ],
    after: [
      "Each of these handles information under its own terms and privacy policy. We share only what a provider needs to do its job.",
    ],
  },
  {
    heading: "Data Sharing",
    body: [
      "We do not sell your personal information. We do not share it for advertising.",
      "We share information with service providers only as far as is reasonably necessary to operate the business — to take a payment, deliver a product, host the site, send you an email, or measure usage where you have agreed to it. We may also disclose information where we are legally required to.",
    ],
  },
  {
    heading: "Data Retention",
    body: [
      "We keep information only as long as there is a reasonable need for it: to support an active licence, to answer questions about past work, to keep accurate accounting records, to protect against fraud, and to meet legal obligations. When there is no longer a reason to keep something, we remove it.",
    ],
  },
  {
    heading: "Your Choices",
    body: ["You are in control of a few things directly:"],
    list: [
      "Accept or decline analytics using the consent banner, and change your mind later by clearing your browser storage",
      "Ask us what personal information we hold about you",
      "Ask us to correct information that is wrong",
      "Ask us to delete personal information, subject to records we are required to keep for legal, accounting, or licensing reasons",
    ],
    after: [
      `Email ${CONTACT} and we will respond. We may need to confirm who you are before acting on a request.`,
    ],
  },
  {
    heading: "Security",
    body: [
      "We use appropriate technical and organizational measures to protect the information we hold, including keeping credentials off the public site and limiting access to what is needed.",
      "No system is completely secure, and we will not claim otherwise. If something goes wrong in a way that affects you, we will tell you.",
    ],
  },
  {
    heading: "Children's Privacy",
    /* Deliberately makes no claim about who obtained consent for student
       material. Asserting that a school or parent secured permission would be
       a statement about someone else's legal position that no contract here
       establishes. */
    body: [
      "Pressmark Studio's website and digital products are intended for adults, businesses, schools, photographers, and organizations. We do not knowingly collect personal information directly from children under 13 through this website.",
      "Customer-provided project materials may include photographs or related content involving students or minors when supplied by schools, photographers, organizations, or other clients for legitimate project purposes. Pressmark Studio processes those materials only as necessary to provide the requested service and does not use them for unrelated purposes.",
    ],
  },
  {
    heading: "Changes to This Policy",
    body: [
      "We may update this policy as the business or the site changes. When we do, the Last Updated date at the top of this page changes with it. Significant changes will be made clear rather than slipped in quietly.",
    ],
  },
  {
    heading: "Contact",
    body: [
      `For any privacy question — including a request to access, correct, or delete your information — email ${CONTACT}.`,
    ],
  },
];

const slug = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function Privacy() {
  return (
    <div style={S.page}>
      <style>{GLOBAL_CSS + BLOG_RESPONSIVE_CSS}</style>
      <SiteHeader />

      <header
        style={{
          background: PALETTE.ink,
          color: PALETTE.white,
          padding: `clamp(7rem, 13vw, 9.5rem) ${PAGE_X} clamp(2.5rem, 6vw, 4rem)`,
          borderBottom: `1px solid ${PALETTE.borderOnDark}`,
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ ...S.eyebrow, marginBottom: "1.25rem" }}>
            <span style={S.eyebrowLine} />
            Pressmark Studio
          </div>
          <h1 style={{ ...S.h1, color: PALETTE.white, marginBottom: "1rem" }}>Privacy Policy</h1>
          <p style={{ fontSize: "0.92rem", color: PALETTE.textOnDarkMuted, letterSpacing: "0.04em" }}>
            Last Updated: {LAST_UPDATED}
          </p>
        </div>
      </header>

      <main style={{ padding: `clamp(2.5rem, 6vw, 4.5rem) ${PAGE_X} clamp(3rem, 7vw, 5rem)` }}>
        <div style={{ maxWidth: PROSE_W, margin: "0 auto" }}>
          <p style={{ ...S.lead, marginBottom: "2.5rem" }}>
            This explains what information Pressmark Studio collects, why, and what you can
            do about it. We have tried to write it in plain language rather than legal
            boilerplate. If anything here is unclear, email{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will explain it.
          </p>

          {SECTIONS.map((section, index) => (
            <section key={section.heading} style={{ marginBottom: "2.5rem" }}>
              <h2
                id={slug(section.heading)}
                style={{
                  ...S.h2,
                  fontSize: "clamp(1.35rem, 2.8vw, 1.75rem)",
                  marginBottom: "1rem",
                  scrollMarginTop: "6rem",
                }}
              >
                <span style={{ color: PALETTE.accent, fontSize: "0.7em" }}>{index + 1}. </span>
                {section.heading}
              </h2>

              {section.body?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  style={{ margin: "0 0 1.1rem", fontSize: "1rem", lineHeight: 1.85, color: PALETTE.textMuted }}
                >
                  {paragraph}
                </p>
              ))}

              {section.list && (
                <ul style={{ margin: "0 0 1.1rem", paddingLeft: "1.35rem", color: PALETTE.textMuted, fontSize: "1rem", lineHeight: 1.8 }}>
                  {section.list.map((item) => (
                    <li key={item.slice(0, 40)} style={{ marginBottom: "0.5rem" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {section.after?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  style={{ margin: "0 0 1.1rem", fontSize: "1rem", lineHeight: 1.85, color: PALETTE.textMuted }}
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <p
            style={{
              borderTop: `1px solid ${PALETTE.hairline}`,
              paddingTop: "1.75rem",
              fontFamily: FONT_STACK,
              fontSize: "1.05rem",
              color: PALETTE.text,
            }}
          >
            <a href="/" style={{ textDecoration: "none" }}>← Back to Pressmark Studio</a>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
