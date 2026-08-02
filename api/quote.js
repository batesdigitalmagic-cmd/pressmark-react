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

export const config = { runtime: "edge" };

const ACCOUNTS_DOMAIN = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
const API_DOMAIN = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
const WORKDRIVE_DOMAIN = process.env.ZOHO_WORKDRIVE_DOMAIN || "https://workdrive.zoho.com";
const WORKDRIVE_PARENT_ID = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;

/* Optional custom CRM fields. Anything left unset still reaches the lead
   through the Description summary, so the form works before CRM is customized. */
const CUSTOM_FIELDS = {
  publicationType: process.env.ZOHO_CRM_FIELD_PUBLICATION_TYPE,
  estimatedPageCount: process.env.ZOHO_CRM_FIELD_PAGE_COUNT,
  deadline: process.env.ZOHO_CRM_FIELD_DEADLINE,
  budgetRange: process.env.ZOHO_CRM_FIELD_BUDGET,
  workdriveLink: process.env.ZOHO_CRM_FIELD_WORKDRIVE_LINK,
};

const LINK_EXPIRY_DAYS = Number(process.env.ZOHO_UPLOAD_LINK_EXPIRY_DAYS) || 30;

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

/* WorkDrive rejects \ / : * ? " < > | in names. */
export function sanitizeFolderName(name) {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export async function createWorkDriveFolder(token, name) {
  const response = await fetch(`${API_DOMAIN}/workdrive/api/v1/files`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: { type: "files", attributes: { name, parent_id: WORKDRIVE_PARENT_ID } },
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(`WorkDrive folder creation failed: ${JSON.stringify(body)}`);

  // The API has returned `data` as both an object and a single-item array.
  const record = Array.isArray(body.data) ? body.data[0] : body.data;
  const id = record?.id;
  if (!id) throw new Error("WorkDrive folder creation returned no id");

  return { id, url: record?.attributes?.permalink || `${WORKDRIVE_DOMAIN}/folder/${id}` };
}

/*
 * Mints a public upload-only link to a folder, so the customer's files go
 * straight to WorkDrive and never transit this function.
 *
 * role_id 5 = EDIT, 6 = VIEW, 7 = UPLOAD (folders only).
 * allow_download stays false — the link must not expose one client's assets
 * to anyone else who has the URL.
 */
export async function createUploadLink(token, folderId, linkName) {
  const expiry = new Date(Date.now() + LINK_EXPIRY_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  const response = await fetch(`${API_DOMAIN}/workdrive/api/v1/links`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "links",
        attributes: {
          resource_id: folderId,
          link_name: linkName,
          role_id: "7",
          allow_download: false,
          request_user_data: false,
          expiration_date: expiry,
        },
      },
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(`WorkDrive link creation failed: ${JSON.stringify(body)}`);

  const record = Array.isArray(body.data) ? body.data[0] : body.data;
  const link = record?.attributes?.link || record?.attributes?.permalink;
  if (!link) throw new Error("WorkDrive link creation returned no url");

  return link;
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

  if (assets.folderUrl) lines.push("", `Asset folder: ${assets.folderUrl}`);
  if (assets.uploadUrl) lines.push(`Customer upload link: ${assets.uploadUrl}`);
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
      assets.uploadUrl = await createUploadLink(token, folder.id, folderName);
    } catch (error) {
      console.error(error);
      assets.note = "NOTE: Could not issue a WorkDrive upload link. Request assets from the client.";
    }
  }

  try {
    const leadId = await createLead(token, fields, assets);
    return json({ ok: true, leadId, uploadUrl: assets.uploadUrl || null });
  } catch (error) {
    console.error(error);
    return json({ error: "Could not save your request. Please email quotes@pressmark.studio." }, 502);
  }
}
