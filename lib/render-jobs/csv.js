export const REQUIRED_HEADERS = ["last_name", "first_name"];
export const OPTIONAL_HEADERS = ["address", "phone", "alternate_phone", "email", "alternate_email", "family_members"];
export const SUPPORTED_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

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
  if (records.some((record) => !record.last_name || !record.first_name)) throw new Error("Every data row must include last_name and first_name.");
  records.sort((a, b) => a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" }) || a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" }));
  const normalized = [headers.join(",")].concat(records.map((record) => headers.map((header) => csvCell(record[header])).join(","))).join("\r\n") + "\r\n";
  return { bytes: new TextEncoder().encode(normalized), rowCount: records.length, headers, records };
}
