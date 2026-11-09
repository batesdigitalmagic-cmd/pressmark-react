/*
 * Structural checks on a finished PDF before it may be offered as the final file.
 *
 * SERVER ONLY.
 *
 * What this DOES verify: it parses as a PDF, ends properly, has pages, and every
 * page is the template's trim size. What it does NOT verify, and says so in its
 * result: font embedding, colour space (CMYK), bleed, PDF/X conformance. Those
 * need a preflight engine; until one is wired in, nothing here may claim them.
 */

import { createHash } from "node:crypto";

const NOT_CHECKED = ["font embedding", "CMYK colour space", "bleed", "PDF/X conformance", "image resolution"];
const TOLERANCE_IN = 0.02;

export async function validatePdf(bytes, { trim }) {
  const problems = [];
  const checks = [];
  const head = Buffer.from(bytes.slice(0, 8)).toString("latin1");
  const tail = Buffer.from(bytes.slice(-1100)).toString("latin1");

  if (head.startsWith("%PDF-")) checks.push("PDF header present"); else problems.push("File does not start with a PDF header.");
  if (tail.includes("%%EOF")) checks.push("End-of-file marker present"); else problems.push("File is truncated (no %%EOF marker).");

  let pages = 0;
  const sizes = [];
  if (problems.length === 0) {
    let doc;
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0, isEvalSupported: false }).promise;
      pages = doc.numPages;
      for (let n = 1; n <= pages; n += 1) {
        const view = (await doc.getPage(n)).getViewport({ scale: 1 });
        sizes.push([view.width / 72, view.height / 72]);
      }
    } catch (error) {
      problems.push(`The PDF could not be parsed: ${String(error?.message || error).slice(0, 120)}`);
    } finally {
      await doc?.destroy?.();
    }
  }
  if (pages > 0) {
    checks.push(`${pages} page${pages === 1 ? "" : "s"} readable`);
    const wrong = sizes
      .map((s, i) => ({ page: i + 1, w: s[0], h: s[1] }))
      .filter((s) => Math.abs(s.w - trim.width) > TOLERANCE_IN || Math.abs(s.h - trim.height) > TOLERANCE_IN);
    if (wrong.length === 0) checks.push(`Every page is ${trim.width} × ${trim.height} in`);
    else {
      const first = wrong[0];
      problems.push(`${wrong.length} page(s) are not ${trim.width} × ${trim.height} in (page ${first.page} is ${first.w.toFixed(2)} × ${first.h.toFixed(2)} in).`);
    }
  }
  return {
    ok: problems.length === 0,
    pages,
    checks,
    problems,
    notChecked: NOT_CHECKED,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}
