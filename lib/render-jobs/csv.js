/*
 * The Directory Classic contract — the merge fields of
 * church-directory-classic.indd, and the same schema the browser uses
 * (src/instant-proof/csv/schemas.js `church-directory`).
 *
 * `address`, `phone` and `email` moved from optional to required here so the
 * upload, the mapping step, the browser proof and this validator all agree on
 * what a directory record is. A CSV that satisfies the upload step cannot then
 * be refused at submission.
 *
 * Required means the COLUMN must be present. Per-row, only `last_name` and
 * `first_name` must carry a value — those two are what the listing is set from
 * and what the server sorts on, whereas a household with no email is a normal
 * directory entry, not a broken one.
 */
export const REQUIRED_HEADERS = ["last_name", "first_name", "address", "phone", "email"];
export const OPTIONAL_HEADERS = ["alternate_phone", "alternate_email", "family_members"];
export const SUPPORTED_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

/* Values these must carry on every row. Wider than this would reject
   legitimate directories; narrower would let an unsortable row through. */
export const REQUIRED_VALUES = ["last_name", "first_name"];

function parseRows(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field === "") quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else if (character === '"') throw new Error("Malformed CSV: an unexpected quote was found.");
    else field += character;
  }
  if (quoted) throw new Error("Malformed CSV: a quoted field was not closed.");
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function validateAndNormalizeCsv(input) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(input);
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("The CSV must contain a header row and at least one data row.");
  const headers = rows[0].map((header) => header.trim());
  headers[0] = headers[0].replace(/^\uFEFF/, "");
  if (new Set(headers).size !== headers.length) throw new Error("The CSV contains duplicate headers.");
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  const unsupported = headers.filter((header) => !SUPPORTED_HEADERS.includes(header));
  if (missing.length || unsupported.length) {
    const parts = [];
    if (missing.length) parts.push(`Missing required headers: ${missing.join(", ")}.`);
    if (unsupported.length) parts.push(`Unsupported headers: ${unsupported.join(", ")}.`);
    throw new Error(parts.join(" "));
  }
  const records = rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Malformed CSV: row ${index + 2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
  });
  const rowMissing = records.findIndex((record) =>
    REQUIRED_VALUES.some((header) => !record[header])
  );
  if (rowMissing !== -1) {
    /* Name the row. "Every row must include a name" for a 300-row file is one
       opaque rejection for a problem the customer cannot locate. */
    throw new Error(
      `Row ${rowMissing + 2} is missing ${REQUIRED_VALUES.join(" or ")}. Every data row needs both.`
    );
  }
  records.sort((a, b) => a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" }) || a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" }));
  const normalized = [headers.join(",")].concat(records.map((record) => headers.map((header) => csvCell(record[header])).join(","))).join("\r\n") + "\r\n";
  return { bytes: new TextEncoder().encode(normalized), rowCount: records.length, headers, records };
}
