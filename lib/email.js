/*
 * Client welcome email, sent via the Zoho Mail API from inside /api/quote so
 * it lands in the client's inbox seconds after they submit.
 *
 * Deliberately says nothing about amounts owed: this fires on a quote
 * *request*, before anything has been quoted. Deposit terms are stated as
 * policy only — see PRODUCTION_POLICY below.
 *
 * ── Editing the copy ──
 * The wording lives in this file, in buildWelcomeEmail(). Change it here;
 * no other file needs to know.
 */

const MAIL_DOMAIN = process.env.ZOHO_MAIL_DOMAIN || "https://mail.zoho.com";
const FROM_ADDRESS = process.env.ZOHO_MAIL_FROM_ADDRESS || "quote@pressmark.studio";
const SIGNATURE_NAME = process.env.ZOHO_MAIL_SIGNATURE_NAME || "Justin Bates";

const ACCENT = "#aa7d48";
const INK = "#020814";
const MUTED = "#4b5563";

/* What clients can put in 01 Client Uploads. */
const UPLOAD_CATEGORIES = [
  "Photos",
  "Logos",
  "Spreadsheets",
  "Existing PDFs",
  "Documents",
  "Brand assets",
];

/* What they receive back. */
const NEXT_DELIVERABLES = [
  "Your official proposal",
  "Timeline",
  "Project schedule",
  "Deposit instructions (if you decide to move forward)",
];

const PRODUCTION_POLICY = "Production begins only after proposal approval and deposit.";

/* Zoho Mail resolves the sending account by id. Cached across warm isolates. */
let cachedAccountId = null;

export async function getMailAccountId(token) {
  if (process.env.ZOHO_MAIL_ACCOUNT_ID) return process.env.ZOHO_MAIL_ACCOUNT_ID;
  if (cachedAccountId) return cachedAccountId;

  const response = await fetch(`${MAIL_DOMAIN}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Zoho Mail account lookup failed: ${JSON.stringify(body)}`);

  const account = (body?.data || []).find((a) => a.accountId) || body?.data?.[0];
  if (!account?.accountId) throw new Error("Zoho Mail returned no accountId");

  cachedAccountId = String(account.accountId);
  return cachedAccountId;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bullets(items) {
  return items
    .map(
      (item) =>
        `<li style="margin:0 0 6px;color:${MUTED};font-size:15px;line-height:1.6;">${escapeHtml(item)}</li>`
    )
    .join("");
}

export function buildWelcomeEmail(fields, uploadUrl) {
  const greetingName = (fields.firstName || fields.lastName || "").trim();
  const greeting = greetingName ? `Hi ${escapeHtml(greetingName)},` : "Hello,";

  /* Without a link the button would 404, so that branch drops it entirely and
     promises a follow-up instead. */
  const uploadBlock = uploadUrl
    ? `
      <p style="margin:0 0 18px;color:${MUTED};font-size:15px;line-height:1.7;">
        Please upload your files here:
      </p>
      <p style="margin:0 0 12px;">
        <a href="${escapeHtml(uploadUrl)}"
           style="display:inline-block;background:${ACCENT};color:#000;text-decoration:none;
                  font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase;
                  padding:14px 28px;border-radius:2px;">Upload Your Files</a>
      </p>
      <p style="margin:0 0 28px;color:${MUTED};font-size:12px;line-height:1.6;word-break:break-all;">
        Or paste this into your browser:<br />
        <a href="${escapeHtml(uploadUrl)}" style="color:${ACCENT};">${escapeHtml(uploadUrl)}</a>
      </p>`
    : `
      <p style="margin:0 0 28px;color:${MUTED};font-size:15px;line-height:1.7;">
        We'll send your secure upload link shortly.
      </p>`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px 12px;background:#f6f5f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#fff;border:1px solid rgba(170,125,72,.3);border-collapse:collapse;">
        <tr><td style="padding:36px 40px;font-family:Inter,'Helvetica Neue',Arial,sans-serif;">

          <p style="margin:0 0 22px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${ACCENT};font-weight:700;">
            Pressmark Studio
          </p>

          <p style="margin:0 0 18px;color:${INK};font-size:17px;">${greeting}</p>

          <p style="margin:0 0 18px;color:${MUTED};font-size:15px;line-height:1.7;">
            Thank you for contacting Pressmark Studio.
          </p>
          <p style="margin:0 0 22px;color:${MUTED};font-size:15px;line-height:1.7;">
            We've created a secure project workspace for your publication.
          </p>

          ${uploadBlock}

          <p style="margin:0 0 10px;color:${INK};font-size:15px;font-weight:600;">You can upload:</p>
          <ul style="margin:0 0 26px;padding-left:20px;">${bullets(UPLOAD_CATEGORIES)}</ul>

          <p style="margin:0 0 10px;color:${INK};font-size:15px;font-weight:600;">We'll review everything and send you:</p>
          <ul style="margin:0 0 26px;padding-left:20px;">${bullets(NEXT_DELIVERABLES)}</ul>

          <p style="margin:0 0 28px;color:${MUTED};font-size:14px;line-height:1.7;
                    border-left:3px solid ${ACCENT};padding-left:14px;">
            ${escapeHtml(PRODUCTION_POLICY)}
          </p>

          <p style="margin:0 0 4px;color:${MUTED};font-size:15px;">Thanks,</p>
          <p style="margin:0;color:${INK};font-size:15px;font-weight:600;">${escapeHtml(SIGNATURE_NAME)}</p>
          <p style="margin:0;color:${MUTED};font-size:14px;">Pressmark Studio</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: "We've received your publication project.", html };
}

/*
 * Best-effort by contract: callers must not let a mail failure affect the
 * lead. The confirmation screen shows the same upload link, so a bounced
 * email never leaves the client without it.
 */
export async function sendWelcomeEmail(token, fields, uploadUrl) {
  if (!fields.email) throw new Error("No recipient address");

  const accountId = await getMailAccountId(token);
  const { subject, html } = buildWelcomeEmail(fields, uploadUrl);

  const response = await fetch(`${MAIL_DOMAIN}/api/accounts/${accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fromAddress: FROM_ADDRESS,
      toAddress: fields.email,
      subject,
      content: html,
      mailFormat: "html",
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(`Zoho Mail send failed: ${JSON.stringify(body)}`);
  return body;
}
