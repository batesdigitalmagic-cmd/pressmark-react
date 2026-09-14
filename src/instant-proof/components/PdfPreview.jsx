/*
 * The finished PDF, shown in the page.
 *
 * ── Why pdf.js and not an <iframe> ──
 *
 * A PDF in an iframe works on a desktop browser and almost nowhere else: Chrome
 * on Android downloads it instead of showing it, and Safari on iPhone shows the
 * first page and stops. The point of this preview is that a visitor can see the
 * result on whatever they are holding, so each page is drawn to a canvas with
 * pdf.js, which behaves the same on every screen.
 *
 * pdf.js is imported only when a preview is actually shown, so the tool's first
 * load does not pay for it. The legacy build is used because it supports the
 * older phone browsers the modern build has dropped.
 *
 * ── Lazily, page by page ──
 *
 * A real directory can run to hundreds of pages. Every page gets a placeholder
 * of the right shape straight away, so the scroll length is correct, and is
 * drawn only as it approaches the screen.
 *
 * ── The bytes ──
 *
 * Fetched from the same protected download link as the Download button. That
 * response asks the browser to save the file, but the header only applies to
 * navigation — a fetch reads the bytes like any other, and nothing is saved.
 */

import { useEffect, useRef, useState } from "react";

/* Canvas pixels per CSS pixel. Capped: a 3x phone would triple the memory of
   every page for sharpness nobody can see at this size. */
const MAX_SCALE = 2;

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

function Page({ pdf, number, ratio, width }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  /* Without IntersectionObserver every page is simply drawn straight away. */
  const [visible, setVisible] = useState(() => !("IntersectionObserver" in window));

  /* Draw once the page is within a screen of the viewport. */
  useEffect(() => {
    const node = holder.current;
    if (!node || !("IntersectionObserver" in window)) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !width) return undefined;
    let task;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, MAX_SCALE);
      const viewport = page.getViewport({ scale });
      const node = canvas.current;
      if (!node) return;
      node.width = Math.floor(viewport.width);
      node.height = Math.floor(viewport.height);
      task = page.render({ canvas: node, canvasContext: node.getContext("2d"), viewport });
      await task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, number, visible, width]);

  return (
    <figure className="ip-pdf-page" ref={holder} style={{ aspectRatio: ratio }}>
      <canvas ref={canvas} aria-hidden="true" />
      <figcaption className="ip-sr-only">Page {number}</figcaption>
    </figure>
  );
}

export default function PdfPreview({ url, title = "Your PDF", onShown }) {
  /* Kept in a ref so a new callback identity from the parent never reloads the PDF. */
  const shown = useRef(onShown);
  useEffect(() => {
    shown.current = onShown;
  }, [onShown]);
  const frame = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [ratios, setRatios] = useState([]);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(0);

  /* Load the document. */
  useEffect(() => {
    let cancelled = false;
    let loaded;
    (async () => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error("The PDF could not be loaded for preview.");
        const data = new Uint8Array(await response.arrayBuffer());
        const pdfjs = await loadPdfJs();
        loaded = await pdfjs.getDocument({ data }).promise;
        /* The first page's shape for every placeholder. A directory's pages are
           all one size, and reading every page up front would parse a
           five-hundred-page PDF before showing any of it. A page that differs
           simply draws at its own shape inside the space. */
        const first = (await loaded.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setRatios(Array.from({ length: loaded.numPages }, () => `${first.width} / ${first.height}`));
        setPdf(loaded);
        shown.current?.(loaded.numPages);
      } catch {
        if (!cancelled) setError("The preview could not be shown here. The download still works.");
      }
    })();
    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, [url]);

  /* Redraw at the new width when the column changes size, e.g. a phone rotating. */
  useEffect(() => {
    const node = frame.current;
    if (!node) return undefined;
    const measure = () => setWidth(Math.round(node.clientWidth));
    measure();
    if (!("ResizeObserver" in window)) return undefined;
    let timer;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    });
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [pdf]);

  if (error) return <p className="ip-note ip-muted">{error}</p>;

  return (
    <section className="ip-pdf" aria-label={`${title} preview`} aria-busy={!pdf}>
      <div className="ip-pdf-bar">
        <span>{title}</span>
        <span className="ip-muted">
          {pdf ? `${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"}` : "Loading preview…"}
        </span>
      </div>
      <div className="ip-pdf-pages" ref={frame}>
        {pdf &&
          ratios.map((ratio, index) => (
            <Page key={index} pdf={pdf} number={index + 1} ratio={ratio} width={width} />
          ))}
        {!pdf && <div className="ip-pdf-page ip-pdf-loading" style={{ aspectRatio: "5.5 / 8.5" }} />}
      </div>
    </section>
  );
}
