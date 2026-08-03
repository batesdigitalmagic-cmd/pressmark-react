/*
 * Quote request intake.
 *
 * Browser → this function → Zoho WorkDrive (per-lead folder + upload link)
 *                        → Zoho CRM (Lead, carrying both links)
 *                        → upload link returned to the browser
 *
 * Customer files never pass through here. The browser gets a scoped WorkDrive
 * upload link and posts directly to Zoho, so there is no serverless body limit
 * to hit. A Zoho Flow "new file in folder" trigger picks up from there and
 * updates the lead; the CRM "new lead" trigger drives everything else —
 * notifications, deals, production tasks.
 *
 * The lead is created from the form, not from the upload, so an inquiry with
 * no attachment is still a lead and no form data depends on a file arriving.
 */

import {
  CLIENT_UPLOAD_FOLDER,
  createFolderTree,
  createUploadLink,
  createWorkDriveFolder,
  sanitizeFolderName,
} from "../lib/workdrive.js";
import { sendWelcomeEmail } from "../lib/email.js";

export { createUploadLink, createWorkDriveFolder, sanitizeFolderName };

export const config = { runtime: "edge" };

const ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
const API_DOMAIN = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
const WORKDRIVE_PARENT_ID = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;

/* Optional custom CRM fields. Anything left unset still reaches the lead
   through the Description summary, so the form works before CRM is customized. */
const CUSTOM_FIELDS = {
  publicationType: process.env.ZOHO_CRM_FIELD_PUBLICATION_TYPE,
  estimatedPageCount: process.env.ZOHO_CRM_FIELD_PAGE_COUNT,
  deadline: process.env.ZOHO_CRM_FIELD_DEADLINE,
  budgetRange: process.env.ZOHO_CRM_FIELD_BUDGET,
  workdriveLink: process.env.ZOHO_CRM_FIELD_WORKDRIVE_LINK,
  uploadLink: process.env.ZOHO_CRM_FIELD_UPLOAD_LINK,
};

/* Edge isolates are reused between invocations, so caching the access token
   saves a round trip to Zoho accounts on most requests. */
let cachedToken = null;

export async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const response = await fetch(`${ACCOUNTS_DOMAIN}/oauth/v2/token?${params}`, { method: "POST" });
  const body = await response.json();

  if (!response.ok || !body.access_token) {
    throw new Error(`Zoho token refresh failed: ${body.error || response.status}`);
  }

  cachedToken = {
    value: body.access_token,
    // Expire a minute early so a token never dies mid-request.
    expiresAt: Date.now() + ((body.expires_in || 3600) - 60) * 1000,
  };
  return cachedToken.value;
}

function buildDescription(fields, assets) {
  const lines = [
    `Publication type: ${fields.publicationType || "Not specified"}`,
    `Estimated page count: ${fields.estimatedPageCount || "Not specified"}`,
    `Deadline: ${fields.deadline || "Not specified"}`,
    `Budget range: ${fields.budgetRange || "Not specified"}`,
    "",
    "Project details:",
    fields.projectDetails || "None provided.",
  ];

  if (assets.folderUrl) lines.push("", `Project folder: ${assets.folderUrl}`);
  if (assets.uploadUrl) lines.push(`Customer upload link (${CLIENT_UPLOAD_FOLDER}): ${assets.uploadUrl}`);
  if (assets.note) lines.push("", assets.note);

  return lines.join("\n");
}

export async function createLead(token, fields, assets) {
  const lead = {
    Last_Name: fields.lastName,
    First_Name: fields.firstName || undefined,
    Email: fields.email,
    Phone: fields.phone || undefined,
    // CRM requires Company on every Lead; the form requires Organization to match.
    Company: fields.organization || fields.lastName,
    Lead_Source: "Website Quote Form",
    Description: buildDescription(fields, assets),
  };

  if (CUSTOM_FIELDS.publicationType && fields.publicationType) {
    lead[CUSTOM_FIELDS.publicationType] = fields.publicationType;
  }
  if (CUSTOM_FIELDS.estimatedPageCount && fields.estimatedPageCount) {
    lead[CUSTOM_FIELDS.estimatedPageCount] = fields.estimatedPageCount;
  }
  if (CUSTOM_FIELDS.deadline && fields.deadline) {
    lead[CUSTOM_FIELDS.deadline] = fields.deadline;
  }
  if (CUSTOM_FIELDS.budgetRange && fields.budgetRange) {
    lead[CUSTOM_FIELDS.budgetRange] = fields.budgetRange;
  }
  if (CUSTOM_FIELDS.workdriveLink && assets.folderUrl) {
    lead[CUSTOM_FIELDS.workdriveLink] = assets.folderUrl;
  }
  /* Kept in its own field so Zoho Flow can merge it into the welcome email
     without parsing it back out of Description. */
  if (CUSTOM_FIELDS.uploadLink && assets.uploadUrl) {
    lead[CUSTOM_FIELDS.uploadLink] = assets.uploadUrl;
  }

  const response = await fetch(`${API_DOMAIN}/crm/v8/Leads`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    // `workflow` lets CRM workflow rules and the Zoho Flow trigger fire.
    body: JSON.stringify({ data: [lead], trigger: ["workflow"] }),
  });

  const body = await response.json();
  const record = body?.data?.[0];

  if (!response.ok || record?.status !== "success") {
    throw new Error(`CRM lead creation failed: ${JSON.stringify(body)}`);
  }
  return record.details?.id;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Could not read the submitted form." }, 400);
  }

  const read = (key) => (payload?.[key] ?? "").toString().trim();

  // Honeypot: real users never see this field. Bots get a success response so
  // they stop retrying, but nothing reaches CRM.
  if (read("website")) return json({ ok: true });

  const fields = {
    firstName: read("firstName"),
    lastName: read("lastName"),
    email: read("email"),
    phone: read("phone"),
    organization: read("organization"),
    publicationType: read("publicationType"),
    estimatedPageCount: read("estimatedPageCount"),
    deadline: read("deadline"),
    budgetRange: read("budgetRange"),
    projectDetails: read("projectDetails"),
  };

  if (!fields.lastName || !fields.email || !fields.organization) {
    return json({ error: "Name, email address, and organization are required." }, 400);
  }

  let token;
  try {
    token = await getAccessToken();
  } catch (error) {
    console.error(error);
    return json({ error: "Could not reach Zoho. Please email quotes@pressmark.studio." }, 502);
  }

  /* WorkDrive is best-effort. If the folder or link fails, the lead is still
     created — we just lose the self-serve upload and chase the assets by hand. */
  const assets = { folderUrl: "", uploadUrl: "", note: "" };

  if (!WORKDRIVE_PARENT_ID) {
    assets.note = "NOTE: WorkDrive is not configured, so no upload link was issued.";
  } else {
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const folderName = sanitizeFolderName(
        `${fields.organization} - ${fields.firstName} ${fields.lastName} - ${stamp}`
      );
      const folder = await createWorkDriveFolder(token, folderName);
      assets.folderUrl = folder.url;

      /* Nested tree is best-effort: a failed subfolder must not cost us the
         project folder or the lead. */
      const tree = await createFolderTree(token, folder.id, fields.publicationType);
      if (tree.failed.length) {
        const detail = tree.failed.map((f) => f.path).join(", ");
        assets.note = `NOTE: ${tree.failed.length} project subfolder(s) could not be created: ${detail}. Create them by hand in WorkDrive.`;
      }

      /* The link is scoped to 01 Client Uploads so customers never see proofs,
         working files, or deliverables. If that folder is missing we issue no
         link at all rather than falling back to the project root. */
      const uploadsId = tree.folders[CLIENT_UPLOAD_FOLDER];
      if (uploadsId) {
        /* Kept short deliberately — WorkDrive rejects long link names.
           createUploadLink truncates as a backstop. */
        assets.uploadUrl = await createUploadLink(
          token,
          uploadsId,
          `${fields.organization} uploads`
        );
      } else {
        assets.note = `${assets.note} NOTE: "${CLIENT_UPLOAD_FOLDER}" was not created, so no upload link was issued. Request assets from the client.`.trim();
      }
    } catch (error) {
      console.error(error);
      // Append — a tree-failure note may already be recorded above.
      assets.note = `${assets.note} NOTE: Could not issue a WorkDrive upload link. Request assets from the client.`.trim();
    }
  }

  try {
    const leadId = await createLead(token, fields, assets);

    /* Best-effort. The confirmation screen shows the same upload link, so a
       mail failure never leaves the client without it. */
    let emailed = false;
    try {
      await sendWelcomeEmail(token, fields, assets.uploadUrl);
      emailed = true;
    } catch (error) {
      console.error("Welcome email failed:", error.message);
    }

    return json({ ok: true, leadId, emailed, uploadUrl: assets.uploadUrl || null });
  } catch (error) {
    console.error(error);
    return json({ error: "Could not save your request. Please email quotes@pressmark.studio." }, 502);
  }
}
