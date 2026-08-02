/*
 * Zoho WorkDrive: folder creation, project folder trees, and share links.
 *
 * Lives in lib/ rather than api/ because Vercel turns every file under api/
 * into a route. Imported by api/quote.js.
 */

const API_DOMAIN = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
const WORKDRIVE_DOMAIN = process.env.ZOHO_WORKDRIVE_DOMAIN || "https://workdrive.zoho.com";
const WORKDRIVE_PARENT_ID = process.env.ZOHO_WORKDRIVE_PARENT_FOLDER_ID;
const LINK_EXPIRY_DAYS = Number(process.env.ZOHO_UPLOAD_LINK_EXPIRY_DAYS) || 30;

/* WorkDrive keeps hitting rate limits above a handful of parallel writes. */
const CONCURRENCY = 3;

/* Every project gets these, whatever the publication type. */
export const UNIVERSAL_FOLDERS = [
  "00 Admin",
  "01 Client Uploads",
  "02 Brand Assets",
  "03 Source Content",
  "04 Working Files",
  "05 Proofs",
  "06 Print Ready",
  "07 Final Deliverables",
  "08 Archive",
];

/* The folder clients get an upload link to. Everything else stays private. */
export const CLIENT_UPLOAD_FOLDER = "01 Client Uploads";

/* Service-specific subfolders, keyed by the parent universal folder. */
export const SERVICE_TREES = {
  yearbook: {
    "01 Client Uploads": ["Portraits", "Candids", "Sports Photos", "Club Photos", "Senior Ads", "Logos"],
    "03 Source Content": ["Student Data", "Faculty Data", "Captions", "Quotes", "Ads", "Page Ladder"],
    "04 Working Files": ["Cover", "Portrait Pages", "Student Life", "Academics", "Clubs", "Athletics", "Senior Section", "Ads", "InDesign", "Links", "Fonts"],
    "05 Proofs": ["Internal Proofs", "Client Proofs", "Corrections"],
  },
  directory: {
    "01 Client Uploads": ["Member Portraits", "Family Portraits", "Staff Photos", "Ministry Photos", "Logos"],
    "03 Source Content": ["Member Data", "Family Data", "Staff Data", "Ministries", "Welcome Message", "Advertisements"],
    "04 Working Files": ["Cover", "Member Listings", "Family Listings", "Staff Section", "Ministry Section", "Advertisements", "InDesign", "Links", "Fonts"],
    "05 Proofs": ["Data Corrections", "Photo Corrections", "Client Proofs", "Approved Proofs"],
  },
  "annual-report": {
    "01 Client Uploads": ["Leadership Photos", "Program Photos", "Charts", "Logos", "Supporting Documents"],
    "03 Source Content": ["Executive Message", "Financial Data", "Statistics", "Program Content", "Impact Stories", "Credits"],
    "04 Working Files": ["Cover", "Editorial Layout", "Charts and Infographics", "Financial Section", "InDesign", "Links", "Fonts"],
    "05 Proofs": ["Editorial Proofs", "Financial Proofs", "Client Proofs", "Approved Proofs"],
  },
  newsletter: {
    "01 Client Uploads": ["Article Photos", "Event Photos", "Headshots", "Logos"],
    "03 Source Content": ["Articles", "Announcements", "Calendar", "Captions", "Advertisements"],
    "04 Working Files": ["Cover", "Departments", "Features", "Calendar", "InDesign", "Links", "Fonts"],
    "05 Proofs": ["Editorial Corrections", "Client Proofs", "Approved Proofs"],
  },
  program: {
    "01 Client Uploads": ["Honoree Photos", "Event Photos", "Sponsor Logos", "Advertisements"],
    "03 Source Content": ["Program Schedule", "Speaker Bios", "Honoree Bios", "Messages", "Sponsors", "Advertisements"],
    "04 Working Files": ["Cover", "Program Pages", "Biography Pages", "Sponsor Pages", "Advertisement Pages", "InDesign", "Links", "Fonts"],
    "05 Proofs": ["Content Corrections", "Sponsor Corrections", "Client Proofs", "Approved Proofs"],
  },
  cleanup: {
    "01 Client Uploads": ["Original Package", "Original PDFs", "Fonts Provided", "Linked Images Provided"],
    "03 Source Content": ["Client Instructions", "Correction List", "Reference Files"],
    "04 Working Files": ["Original Files", "Repaired Files", "Relinked Assets", "Replaced Fonts", "Preflight Reports", "Packaged Files"],
    "05 Proofs": ["Before Cleanup", "After Cleanup", "Client Corrections", "Approved Proofs"],
  },
  "data-merge": {
    "01 Client Uploads": ["CSV Files", "Excel Files", "Portraits", "Logos", "Source Templates"],
    "03 Source Content": ["Original Data", "Cleaned Data", "Field Mapping", "Data Exceptions"],
    "04 Working Files": ["Data Merge Templates", "Merge Tests", "Merged Documents", "InDesign", "Links", "Fonts"],
    "05 Proofs": ["Data Proofs", "Layout Proofs", "Correction Rounds", "Approved Proofs"],
  },
  prepress: {
    "01 Client Uploads": ["Original PDFs", "Source Artwork", "Fonts", "Linked Images"],
    "03 Source Content": ["Printer Specifications", "Finishing Instructions", "Quantity and Delivery Details"],
    "04 Working Files": ["Preflight Reports", "Corrected PDFs", "Imposition", "Bleed and Crop Fixes", "Color Corrections"],
    "05 Proofs": ["Digital Proofs", "Printer Proofs", "Approved Proofs"],
  },
};

/* Normalized form values → tree key. Anything unlisted gets universal only. */
export const PUBLICATION_TYPE_ALIASES = {
  "yearbook": "yearbook",
  "school yearbook": "yearbook",
  "church directory": "directory",
  "membership directory": "directory",
  "association directory": "directory",
  "directory": "directory",
  "directory design": "directory",
  "annual report": "annual-report",
  "newsletter": "newsletter",
  "program book": "program",
  "commemorative book": "program",
  "event program": "program",
  "program event book": "program",
  "program and event book": "program",
  "publication cleanup": "cleanup",
  "indesign cleanup": "cleanup",
  "publication rescue": "cleanup",
  "data merge": "data-merge",
  "print ready pdf": "prepress",
  "print ready review": "prepress",
  "prepress": "prepress",
  "print production": "prepress",
};

/*
 * Collapses "church-directory", "Church Directory", "CHURCH_DIRECTORY", and
 * "Program / Event Book" onto the same key. Returns null when unrecognized,
 * which callers treat as "universal folders only" rather than an error.
 */
export function normalizePublicationType(value) {
  if (!value) return null;
  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return PUBLICATION_TYPE_ALIASES[normalized] || null;
}

/* WorkDrive rejects \ / : * ? " < > | in names. */
export function sanitizeFolderName(name) {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

async function workdriveFetch(token, path, init = {}) {
  return fetch(`${API_DOMAIN}/workdrive/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      Accept: "application/vnd.api+json",
      ...init.headers,
    },
  });
}

export async function createWorkDriveFolder(token, name, parentId = WORKDRIVE_PARENT_ID) {
  const response = await workdriveFetch(token, "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: { type: "files", attributes: { name: sanitizeFolderName(name), parent_id: parentId } },
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
 * Existing children by name, so a retried request reuses folders instead of
 * duplicating them. A listing failure returns an empty map: creation proceeds
 * and may duplicate, which is far better than aborting the whole request.
 */
export async function listChildFolders(token, folderId) {
  const map = new Map();
  try {
    const response = await workdriveFetch(
      token,
      `/files/${folderId}/files?page[limit]=200&filter[type]=all`
    );
    if (!response.ok) return map;

    const body = await response.json();
    for (const record of body?.data || []) {
      const name = record?.attributes?.name;
      if (name && record.id) map.set(name, record.id);
    }
  } catch {
    // treated as "nothing exists yet"
  }
  return map;
}

/* Bounded parallelism — WorkDrive rate-limits aggressive fan-out. */
async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

/*
 * Creates one level of folders under `parentId`, reusing any that already
 * exist. Never throws — failures are collected so one bad subfolder cannot
 * take down the project folder or the CRM lead.
 */
async function createLevel(token, parentId, names, pathPrefix, summary) {
  const existing = await listChildFolders(token, parentId);

  const outcomes = await mapWithConcurrency(names, CONCURRENCY, async (name) => {
    const path = pathPrefix ? `${pathPrefix}/${name}` : name;

    const existingId = existing.get(sanitizeFolderName(name));
    if (existingId) {
      summary.reused.push({ name, id: existingId, path });
      return [name, existingId];
    }

    try {
      const folder = await createWorkDriveFolder(token, name, parentId);
      summary.created.push({ name, id: folder.id, path });
      return [name, folder.id];
    } catch (error) {
      console.error(`WorkDrive folder failed: name="${name}" parentId="${parentId}" — ${error.message}`);
      summary.failed.push({ name, parentId, path, error: error.message });
      return null;
    }
  });

  return new Map(outcomes.filter(Boolean));
}

/*
 * Builds the full project tree inside an already-created root folder.
 *
 * Universal folders are created first, then service-specific children are
 * nested beneath them. Returns a summary rather than throwing, so the caller
 * can still create the CRM lead when part of the tree fails.
 */
export async function createFolderTree(accessToken, rootFolderId, publicationType) {
  const treeKey = normalizePublicationType(publicationType);
  const summary = {
    publicationType: publicationType || "",
    treeKey,
    matched: Boolean(treeKey),
    created: [],
    reused: [],
    failed: [],
    folders: {},
  };

  const universal = await createLevel(accessToken, rootFolderId, UNIVERSAL_FOLDERS, "", summary);
  for (const [name, id] of universal) summary.folders[name] = id;

  const serviceTree = treeKey ? SERVICE_TREES[treeKey] : null;
  if (!serviceTree) return summary;

  // Sequential across parents; concurrent within each parent.
  for (const [parentName, children] of Object.entries(serviceTree)) {
    const parentId = universal.get(parentName);
    if (!parentId) {
      // Parent failed above; record the children as failed rather than silently skipping.
      for (const child of children) {
        summary.failed.push({
          name: child,
          parentId: null,
          path: `${parentName}/${child}`,
          error: `parent folder "${parentName}" was not created`,
        });
      }
      continue;
    }
    await createLevel(accessToken, parentId, children, parentName, summary);
  }

  return summary;
}

/*
 * Mints a public upload-only link so customer files go straight to WorkDrive
 * and never transit the serverless function.
 *
 * role_id 5 = EDIT, 6 = VIEW, 7 = UPLOAD (folders only).
 * allow_download stays false — the link must not expose folder contents.
 */
export async function createUploadLink(token, folderId, linkName) {
  const expiry = new Date(Date.now() + LINK_EXPIRY_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);

  const url = `${API_DOMAIN}/workdrive/api/v1/links`;
  const payload = {
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
  };

  const response = await workdriveFetch(token, "/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  /* Read as text first. Calling .json() before checking response.ok destroys
     the status whenever Zoho answers with HTML or an empty body. */
  const raw = await response.text();
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // non-JSON response; `raw` is reported verbatim below
  }

  if (!response.ok || !body) {
    console.error(
      "WorkDrive link creation failed:",
      JSON.stringify({
        request: { method: "POST", url, payload },
        response: {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type"),
          body: body ?? raw.slice(0, 1000),
        },
      })
    );
    throw new Error(
      `WorkDrive link creation failed: HTTP ${response.status} ${response.statusText} — ${
        body ? JSON.stringify(body) : raw.slice(0, 300)
      }`
    );
  }

  const record = Array.isArray(body.data) ? body.data[0] : body.data;
  const link = record?.attributes?.link || record?.attributes?.permalink;
  if (!link) {
    console.error(
      "WorkDrive link creation returned no url:",
      JSON.stringify({ request: { url, payload }, response: { status: response.status, body } })
    );
    throw new Error(`WorkDrive link creation returned no url — body: ${JSON.stringify(body)}`);
  }

  return link;
}
