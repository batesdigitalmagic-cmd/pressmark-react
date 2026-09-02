/*
 * CSV parsing — client side, in memory, no dependency.
 *
 * ── Why hand-written rather than a library ──
 *
 * The requirement is a well-bounded subset of RFC 4180: quoted fields that may
 * contain commas, escaped quotes, CRLF or LF line endings, trailing blank rows
 * ignored, header whitespace trimmed. That is a small state machine, and the
 * project's standing rule is not to add dependencies it does not need.
 *
 * If this ever needs character-encoding detection, streaming, or worker-based
 * parsing of very large files, swap in Papa Parse — every caller goes through
 * parseCsv() and parseCsvFile(), so the change is contained to this module.
 *
 * ── Deliberate non-goals ──
 *
 * No type coercion. A ZIP code of "01970" must not become the number 1970, and
 * a phone number must not become a float. Every value stays the string the
 * customer typed. No eval, no Function constructor, no regex backtracking on
 * untrusted input — this is a character scanner.
 */

/**
 * @typedef {object} ParsedTable
 * @property {string[]} headers        Trimmed header names, in file order.
 * @property {string[]} rawHeaders     Headers exactly as they appeared.
 * @property {Record<string,string>[]} rows  One object per data row, keyed by trimmed header.
 * @property {string[][]} matrix       The raw grid, header row included.
 * @property {number} skippedBlankRows
 */

/* A BOM at the start of a UTF-8 file would otherwise become part of the first
   header name, and the result matches no known column. Excel writes these. */
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/**
 * Split CSV text into a grid of raw string cells.
 *
 * Scans character by character with two pieces of state: whether we are inside
 * a quoted field, and the field being accumulated. That is enough to handle
 * every case in the spec correctly, including a quoted field that spans lines.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function toMatrix(text) {
  const source = stripBom(String(text ?? ""));
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        /* A doubled quote inside a quoted field is a literal quote. */
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    /* Treat CRLF as one terminator; a bare CR (old Mac files) also ends a row. */
    if (char === "\r") {
      if (source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  /* Flush whatever the file ended with. A file with no trailing newline still
     has a final row; one that ends with a newline produces a trailing empty
     row, which the blank-row filter below removes. */
  row.push(field);
  rows.push(row);

  return rows;
}

const isBlankRow = (cells) => cells.every((cell) => cell.trim() === "");

/**
 * Parse CSV text into headers and row objects.
 *
 * @param {string} text
 * @returns {ParsedTable}
 */
export function parseCsv(text) {
  const matrix = toMatrix(text);

  /* Leading blank lines before the header are rare but do occur when a file
     has been edited by hand. */
  let headerIndex = 0;
  while (headerIndex < matrix.length && isBlankRow(matrix[headerIndex])) headerIndex += 1;

  if (headerIndex >= matrix.length) {
    return { headers: [], rawHeaders: [], rows: [], matrix: [], skippedBlankRows: 0 };
  }

  const rawHeaders = matrix[headerIndex];
  const headers = rawHeaders.map((header) => header.trim());

  const dataRows = matrix.slice(headerIndex + 1);
  let skippedBlankRows = 0;
  /** @type {Record<string,string>[]} */
  const rows = [];

  for (const cells of dataRows) {
    if (isBlankRow(cells)) {
      skippedBlankRows += 1;
      continue;
    }
    /** @type {Record<string,string>} */
    const record = {};
    headers.forEach((header, column) => {
      if (header === "") return; // an unnamed column carries no addressable data
      /* Values keep the customer's original text. Only the *header* is
         normalized — trimming a value could change a deliberate " Jr." spacing
         or a leading-zero-preserving quoted field. */
      record[header] = cells[column] ?? "";
    });
    rows.push(record);
  }

  return { headers, rawHeaders, rows, matrix, skippedBlankRows };
}

/**
 * Read a File and parse it. Browser-only; nothing is uploaded.
 *
 * @param {File} file
 * @returns {Promise<ParsedTable>}
 */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseCsv(String(reader.result || "")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("The CSV file could not be read."));
    reader.readAsText(file);
  });
}
