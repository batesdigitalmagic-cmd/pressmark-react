/*
 * Yearbook Modern — a Pressmark design template.
 *
 * High-contrast and confident: a heavy sans display face, a full-bleed color
 * field on the cover, tight portrait grids and a bold feature spread. Built for
 * schools and athletic programs.
 *
 * Coordinates are INCHES from the top-left, matching InDesign's geometry panel.
 * See docs/proof-templates.md.
 *
 * The artwork under public/proof-templates/yearbook-modern/ is placeholder;
 * replace it with WebP exports of the production InDesign document.
 */

const DIR = "/proof-templates/yearbook-modern";

const PAGE_W = 8.5;
const PAGE_H = 11;

/** @type {import('./registry.js').DesignTemplate} */
export const yearbookModern = {
  id: "yearbook-modern",
  name: "Yearbook Modern",
  description:
    "Bold and high-contrast. Heavy display type, full-bleed color and a dense portrait grid — built for schools and athletic programs.",
  publicationTypes: ["yearbook", "commemorative-book", "community-publication", "other"],
  styleCategory: "bold",
  inputMode: "photos",
  thumbnail: `${DIR}/thumbnail.svg`,
  schemas: ["yearbook-portraits", "people-directory"],
  pageSize: { width: PAGE_W, height: PAGE_H, unit: "in" },

  fontRoles: {
    display: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 900,
      size: 58,
      lineHeight: 0.94,
      letterSpacing: "-0.02em",
      transform: "uppercase",
    },
    sectionTitle: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 900,
      size: 34,
      lineHeight: 1.0,
      letterSpacing: "-0.01em",
      transform: "uppercase",
    },
    eyebrow: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 800,
      size: 8,
      letterSpacing: "0.28em",
      transform: "uppercase",
    },
    portraitName: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 800,
      size: 8,
      lineHeight: 1.2,
    },
    /* Grade, homeroom and superlatives under a portrait. Deliberately much
       smaller than the name — thirty of these run across a spread. */
    portraitDetail: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 500,
      size: 5.5,
      lineHeight: 1.3,
    },
    quote: {
      family: "'Cormorant Garamond', Georgia, serif",
      weight: 600,
      size: 20,
      lineHeight: 1.3,
      style: "italic",
    },
    body: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 400,
      size: 9,
      lineHeight: 1.6,
    },
    folio: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 800,
      size: 8,
      letterSpacing: "0.12em",
    },
  },

  defaultColors: {
    primary: "#0f1c2e",
    secondary: "#d64933",
    paper: "#ffffff",
    ink: "#0f1c2e",
    onPrimary: "#ffffff",
  },

  footerMark: { text: "Pressmark Studio" },

  /* A real portrait page runs 20–30 students. The sample shows 5×3 per page so
     faces and names stay legible at preview scale. */
  maxRecordsPerPage: 15,
  overflow: "truncate",

  pages: [
    {
      id: "cover",
      pageType: "cover",
      label: "Cover",
      caption: "Your school name and colors in the template's display face.",
      form: "single",
      background: `${DIR}/cover-background.svg`,
      backgroundColor: "primary",
      elements: [
        { type: "block", x: 0, y: 7.2, width: 8.5, height: 0.42, background: "secondary" },
        { type: "image", field: "logo", x: 0.85, y: 1.1, width: 1.8, height: 1.1, fitMode: "contain" },
        {
          type: "text",
          field: "org:organizationName",
          x: 0.85, y: 3.3, width: 6.8, height: 3.4,
          fontRole: "display", color: "onPrimary", alignment: "left",
          textFit: "shrink", maxLines: 3,
          placeholder: "Your School",
        },
        {
          type: "text",
          field: "publicationLabel",
          x: 0.85, y: 7.85, width: 5.0, height: 0.35,
          fontRole: "eyebrow", color: "onPrimary", textFit: "truncate",
        },
        {
          type: "text",
          field: "year",
          x: 0.85, y: 9.6, width: 6.8, height: 0.9,
          fontRole: "sectionTitle", color: "secondary", alignment: "left",
        },
      ],
    },

    {
      id: "portrait-spread",
      pageType: "portrait-spread",
      label: "Interior spread — portraits",
      caption: "Your roster placed into the template's portrait grid.",
      form: "spread",
      background: `${DIR}/portrait-spread-background.svg`,
      backgroundColor: "paper",
      elements: [
        { type: "block", x: 0, y: 0, width: 17, height: 1.15, background: "primary" },
        { type: "text", field: "role:grouping", x: 0.7, y: 0.42, width: 6.0, height: 0.35, fontRole: "eyebrow", color: "onPrimary", textFit: "truncate", placeholder: "Class Portraits" },
        { type: "text", field: "org:organizationName", x: 10.3, y: 0.42, width: 6.0, height: 0.35, fontRole: "eyebrow", color: "secondary", alignment: "right", textFit: "truncate" },

        /* 10 columns × 3 rows across the spread = 30 portrait cells, five per
           page per row, which is what a real portrait page looks like. */
        {
          type: "repeater",
          x: 0.7, y: 1.6, width: 15.6, height: 8.3,
          repeat: { columns: 10, rows: 3, gapX: 0.18, gapY: 0.34 },
          cell: [
            { type: "image", field: "record:image", x: 0, y: 0, width: 1.386, height: 1.73, fitMode: "cover", background: "paper", placeholder: "portrait" },
            {
              type: "text", field: "role:primaryText",
              x: 0, y: 1.82, width: 1.386, height: 0.42,
              fontRole: "portraitName", color: "ink", textFit: "clamp", maxLines: 2,
              placeholder: "Name",
            },
            {
              type: "text", field: "role:secondaryText",
              x: 0, y: 2.24, width: 1.386, height: 0.2,
              fontRole: "portraitDetail", color: "secondary", textFit: "clamp", maxLines: 1,
            },
          ],
        },

        { type: "text", field: "static:34", x: 0.7, y: 10.25, width: 1.0, height: 0.3, fontRole: "folio", color: "ink", opacity: 0.45 },
        { type: "text", field: "static:35", x: 15.3, y: 10.25, width: 1.0, height: 0.3, fontRole: "folio", color: "ink", opacity: 0.45, alignment: "right" },
      ],
    },

    {
      id: "feature-spread",
      pageType: "feature-spread",
      label: "Interior spread — student life",
      caption: "The feature treatment used for activities, athletics and events.",
      form: "spread",
      background: `${DIR}/feature-spread-background.svg`,
      backgroundColor: "paper",
      elements: [
        /* Left page — one dominant photograph. */
        { type: "image", field: "record:image", x: 0, y: 0, width: 8.5, height: 7.4, fitMode: "cover", background: "primary", placeholder: "photo", recordIndex: 0 },
        { type: "block", x: 0, y: 7.4, width: 8.5, height: 3.6, background: "primary" },
        {
          type: "text", field: "role:grouping",
          x: 0.7, y: 7.85, width: 7.1, height: 0.3,
          fontRole: "eyebrow", color: "secondary", textFit: "truncate",
          placeholder: "Student Life", recordIndex: 0,
        },
        {
          type: "text", field: "role:primaryText",
          x: 0.7, y: 8.3, width: 7.1, height: 1.7,
          fontRole: "sectionTitle", color: "onPrimary", textFit: "shrink", maxLines: 3,
          placeholder: "Feature", recordIndex: 0,
        },

        /* Right page — supporting photographs and a pulled quote. */
        {
          type: "repeater",
          x: 9.2, y: 0.75, width: 7.1, height: 4.3,
          repeat: { columns: 2, rows: 2, gapX: 0.24, gapY: 0.24 },
          startIndex: 1,
          cell: [
            { type: "image", field: "record:image", x: 0, y: 0, width: 3.43, height: 2.03, fitMode: "cover", background: "paper", placeholder: "photo" },
          ],
        },
        { type: "rule", x: 9.2, y: 5.55, width: 1.4, height: 0.03, background: "secondary" },
        {
          type: "text", field: "role:bodyText",
          x: 9.2, y: 5.95, width: 7.1, height: 2.6,
          fontRole: "quote", color: "ink", textFit: "clamp", maxLines: 5, recordIndex: 0,
          placeholder: "A quote from your roster's quote column appears here.",
        },
        {
          type: "text", field: "role:primaryText",
          x: 9.2, y: 8.75, width: 7.1, height: 0.4,
          fontRole: "eyebrow", color: "secondary", textFit: "truncate", recordIndex: 0,
        },
        { type: "text", field: "static:52", x: 15.3, y: 10.25, width: 1.0, height: 0.3, fontRole: "folio", color: "ink", opacity: 0.45, alignment: "right" },
      ],
    },
  ],
};
