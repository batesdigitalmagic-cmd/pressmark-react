/*
 * Gallery — the photographs-only Pressmark design.
 *
 * The default for Quick Photo Proof. Every other template reserves vertical
 * bands for a name, a role and contact detail; with photographs alone those
 * bands print as rows of empty space under each picture, which looks like a
 * form somebody forgot to fill in. This design gives that space back to the
 * photographs.
 *
 * Deliberately carries NO per-photograph text. A visitor who supplies names and
 * titles is better served by Directory Classic or Yearbook Modern, which are
 * built to structure them — see photoProject.suggestsPhotoLedDesign().
 *
 * Coordinates are inches from the top-left of the containing box, as everywhere
 * else. See render/geometry.js and docs/proof-templates.md.
 *
 * Artwork under public/proof-templates/photo-gallery/ is placeholder; replace it
 * with WebP exports of the production InDesign document.
 */

const DIR = "/proof-templates/photo-gallery";

const PAGE_W = 8.5;
const PAGE_H = 11;

/** @type {import('./registry.js').DesignTemplate} */
export const photoGallery = {
  id: "photo-gallery",
  name: "Gallery",
  description:
    "Photograph-led. Full-bleed images, generous grids and no captions — the design to choose when the pictures are the story.",
  /* Suits every publication type: any of them can start life as a set of
     photographs with no spreadsheet behind it. */
  publicationTypes: [
    "yearbook",
    "church-directory",
    "membership-directory",
    "association-directory",
    "event-program",
    "annual-report",
    "commemorative-book",
    "community-publication",
    "other",
  ],
  styleCategory: "clean",
  inputMode: "photos",
  thumbnail: `${DIR}/thumbnail.svg`,
  schemas: ["people-directory", "yearbook-portraits"],
  pageSize: { width: PAGE_W, height: PAGE_H, unit: "in" },

  /* Photographs need no type of their own; these serve the cover and folios. */
  fontRoles: {
    display: {
      family: "'Cormorant Garamond', Georgia, serif",
      weight: 700,
      size: 40,
      lineHeight: 1.05,
      letterSpacing: "0.01em",
    },
    eyebrow: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 700,
      size: 8,
      letterSpacing: "0.28em",
      transform: "uppercase",
    },
    folio: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 600,
      size: 8,
      letterSpacing: "0.14em",
    },
  },

  defaultColors: {
    primary: "#1f3a5f",
    secondary: "#aa7d48",
    paper: "#ffffff",
    ink: "#101418",
    onPrimary: "#ffffff",
  },

  footerMark: { text: "Pressmark Studio" },

  maxRecordsPerPage: 8,
  overflow: "truncate",

  pages: [
    {
      /*
       * Cover: the first photograph, full bleed, with a scrim carrying the
       * title. The scrim is a flat ink block at low opacity rather than a
       * gradient — blocks are the primitive the manifest has, and a hard band
       * reads as deliberate design where a half-hearted fade would not.
       */
      id: "cover",
      pageType: "cover",
      label: "Cover",
      caption: "Your first photograph, full bleed, with your organization's name.",
      form: "single",
      backgroundColor: "primary",
      /* Light type sits on the scrim, not on the page colour. */
      footerOnDark: true,
      elements: [
        { type: "image", field: "record:image", x: 0, y: 0, width: 8.5, height: 11, fitMode: "cover", background: "primary", placeholder: "photo", recordIndex: 0 },
        { type: "block", x: 0, y: 6.1, width: 8.5, height: 4.9, background: "ink", opacity: 0.64 },
        { type: "rule", x: 0.9, y: 7.15, width: 1.2, height: 0.022, background: "secondary" },
        {
          type: "text", field: "publicationLabel",
          x: 0.9, y: 7.5, width: 6.7, height: 0.32,
          fontRole: "eyebrow", color: "secondary", textFit: "truncate",
        },
        {
          type: "text", field: "org:organizationName",
          x: 0.9, y: 7.95, width: 6.7, height: 1.7,
          fontRole: "display", color: "onPrimary",
          textFit: "shrink", maxLines: 2,
          placeholder: "Your Organization",
        },
        {
          type: "text", field: "year",
          x: 0.9, y: 9.85, width: 6.7, height: 0.3,
          fontRole: "folio", color: "onPrimary", opacity: 0.65,
        },
      ],
    },

    {
      /*
       * Gallery spread: eight photographs, four a page, as two per-page grids
       * so nothing crosses the fold.
       *
       *   outside margin 0.60in   gutter 0.60in each side (1.20in across)
       *   cell           3.50 x 4.75in
       */
      id: "gallery-spread",
      pageType: "gallery-spread",
      label: "Interior spread — gallery",
      caption: "Eight of your photographs, evenly set across facing pages.",
      form: "spread",
      background: `${DIR}/gallery-spread-background.svg`,
      backgroundColor: "paper",
      elements: [
        {
          type: "repeater",
          x: 0.6, y: 0.6, width: 7.3, height: 9.8,
          repeat: { columns: 2, rows: 2, gapX: 0.3, gapY: 0.3 },
          startIndex: 0,
          cell: [
            { type: "image", field: "record:image", x: 0, y: 0, width: 3.5, height: 4.75, fitMode: "cover", background: "paper", placeholder: "photo" },
          ],
        },
        {
          type: "repeater",
          x: 9.1, y: 0.6, width: 7.3, height: 9.8,
          repeat: { columns: 2, rows: 2, gapX: 0.3, gapY: 0.3 },
          startIndex: 4,
          cell: [
            { type: "image", field: "record:image", x: 0, y: 0, width: 3.5, height: 4.75, fitMode: "cover", background: "paper", placeholder: "photo" },
          ],
        },
        { type: "text", field: "static:8", x: 0.6, y: 10.5, width: 1.0, height: 0.26, fontRole: "folio", color: "ink", opacity: 0.38 },
        { type: "text", field: "static:9", x: 15.4, y: 10.5, width: 1.0, height: 0.26, fontRole: "folio", color: "ink", opacity: 0.38, alignment: "right" },
      ],
    },

    {
      /*
       * Feature spread: one photograph given a full page, three stacked
       * opposite. The rhythm change is what keeps a gallery from reading as a
       * contact sheet.
       */
      id: "feature-spread",
      pageType: "feature-spread",
      label: "Interior spread — feature",
      caption: "One photograph given a full page, with three set against it.",
      form: "spread",
      background: `${DIR}/feature-spread-background.svg`,
      backgroundColor: "paper",
      elements: [
        {
          type: "repeater",
          x: 0, y: 0, width: 8.5, height: 11,
          repeat: { columns: 1, rows: 1, gapX: 0, gapY: 0 },
          startIndex: 0,
          cell: [
            { type: "image", field: "record:image", x: 0, y: 0, width: 8.5, height: 11, fitMode: "cover", background: "primary", placeholder: "photo" },
          ],
        },
        {
          type: "repeater",
          x: 9.1, y: 0.6, width: 7.3, height: 9.8,
          repeat: { columns: 1, rows: 3, gapX: 0, gapY: 0.3 },
          startIndex: 1,
          cell: [
            { type: "image", field: "record:image", x: 0, y: 0, width: 7.3, height: 3.066, fitMode: "cover", background: "paper", placeholder: "photo" },
          ],
        },
        { type: "text", field: "static:17", x: 15.4, y: 10.5, width: 1.0, height: 0.26, fontRole: "folio", color: "ink", opacity: 0.38, alignment: "right" },
      ],
    },
  ],
};
