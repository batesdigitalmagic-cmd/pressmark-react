/*
 * Directory Classic — a Pressmark design template.
 *
 * A formal, symmetrical directory: generous margins, a fine bronze rule under
 * every listing, a serif display face and a quiet sans for contact detail. The
 * layout Pressmark actually produces for churches, associations and membership
 * organizations.
 *
 * All coordinates are INCHES from the top-left of the page, matching InDesign's
 * geometry panel. See docs/proof-templates.md for how to author a replacement.
 *
 * ── Artwork ──
 *
 * `background` paths point at public/proof-templates/directory-classic/. The
 * files there now are restrained placeholders generated for this prototype.
 * Replace them with WebP exports of the real InDesign artwork; the manifest
 * only needs its path updated if the extension changes.
 */

const DIR = "/proof-templates/directory-classic";

/* One trim size drives every page. A spread is two of these side by side, so
   a spread page's element coordinates run across the full 17in width. */
const PAGE_W = 8.5;
const PAGE_H = 11;

/*
 * One profile card.
 *
 * Coordinates are inches from the top-left of the CARD, not the page — a
 * repeater cell is its own coordinate box (see render/geometry.js). The card is
 * 2.18 x 4.17in and every field below has its own reserved band, so a missing
 * title or a two-line name cannot push anything into the field beneath it:
 *
 *   portrait      0.00 -> 2.35   fixed 2.18 x 2.35 frame, cover-cropped
 *   rule          2.46
 *   name          2.60 -> 3.10   16pt, up to 2 lines  (2 x 16 x 1.10 = 0.489in)
 *   title         3.16 -> 3.57   12pt, up to 2 lines  (2 x 12 x 1.20 = 0.400in)
 *   address       3.63 -> 3.98   10pt, up to 2 lines  (2 x 10 x 1.25 = 0.347in)
 *   city/state    3.99 -> 4.16   10pt, one line       (1 x 10 x 1.20 = 0.167in)
 *
 * The last band ends at 4.16in inside a 4.17in card. Every reserved height
 * exceeds what its type can occupy at its declared maxLines, so overlap is
 * arithmetically impossible rather than merely unlikely — verify:proof asserts
 * both facts.
 */
const PROFILE_CARD = [
  {
    type: "image",
    field: "record:image",
    x: 0, y: 0, width: 2.18, height: 2.35,
    fitMode: "cover",
    background: "paper",
    placeholder: "portrait",
  },
  { type: "rule", x: 0, y: 2.46, width: 0.7, height: 0.018, background: "secondary" },
  {
    /* personName, not role:primaryText — it falls back to first + last when a
       spreadsheet has no display_name column. */
    type: "text", field: "personName",
    x: 0, y: 2.6, width: 2.18, height: 0.5,
    fontRole: "listingName", color: "ink",
    textFit: "shrink", maxLines: 2,
  },
  {
    type: "text", field: "role:secondaryText",
    x: 0, y: 3.16, width: 2.18, height: 0.41,
    fontRole: "listingTitle", color: "secondary",
    textFit: "clamp", maxLines: 2,
  },
  {
    type: "text", field: "streetAddress",
    x: 0, y: 3.63, width: 2.18, height: 0.35,
    fontRole: "listingDetail", color: "ink", opacity: 0.72,
    textFit: "clamp", maxLines: 2,
  },
  {
    type: "text", field: "cityStateLine",
    x: 0, y: 3.99, width: 2.18, height: 0.17,
    fontRole: "listingMeta", color: "ink", opacity: 0.62,
    textFit: "truncate", maxLines: 1,
  },
];

/** @type {import('./registry.js').DesignTemplate} */
export const directoryClassic = {
  id: "directory-classic",
  name: "Directory Classic",
  description:
    "Formal and symmetrical. Serif display type, fine rules and generous margins — the layout most churches, associations and membership groups choose.",
  publicationTypes: [
    "church-directory",
    "membership-directory",
    "association-directory",
    "community-publication",
    "other",
  ],
  styleCategory: "traditional",
  inputMode: "csv",
  thumbnail: `${DIR}/thumbnail.png`,
  schemas: ["people-directory"],
  pageSize: { width: PAGE_W, height: PAGE_H, unit: "in" },

  fontRoles: {
    display: {
      family: "'Cormorant Garamond', Georgia, serif",
      weight: 700,
      size: 44,
      lineHeight: 1.06,
      letterSpacing: "0.01em",
    },
    sectionTitle: {
      family: "'Cormorant Garamond', Georgia, serif",
      weight: 700,
      size: 26,
      lineHeight: 1.12,
    },
    eyebrow: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 700,
      size: 8,
      letterSpacing: "0.26em",
      transform: "uppercase",
    },

    /*
     * The profile card's three steps. Sizes are points; at the results view's
     * ~972px spread they render at roughly 12.7px / 9.5px / 7.9px, which is the
     * hierarchy a printed directory actually uses — the name carries the page
     * and the contact detail stays quiet.
     */
    listingName: {
      family: "'Cormorant Garamond', Georgia, serif",
      weight: 700,
      size: 16,
      lineHeight: 1.1,
    },
    listingTitle: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 600,
      size: 12,
      lineHeight: 1.2,
      letterSpacing: "0.01em",
    },
    listingDetail: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 400,
      size: 10,
      lineHeight: 1.25,
    },
    listingMeta: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 400,
      size: 10,
      lineHeight: 1.2,
    },

    body: {
      family: "Inter, 'Helvetica Neue', Arial, sans-serif",
      weight: 400,
      size: 12,
      lineHeight: 1.6,
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

  /* Six profile cards a page, twelve across the spread. A real directory runs
     8–12 a page; the sample deliberately shows fewer, larger records. */
  maxRecordsPerPage: 6,
  overflow: "truncate",

  pages: [
    {
      id: "cover",
      pageType: "cover",
      label: "Cover",
      caption: "Your organization name and logo set in the template's display face.",
      form: "single",
      background: `${DIR}/cover-background.svg`,
      backgroundColor: "primary",
      elements: [
        { type: "image", field: "logo", x: 3.0, y: 1.9, width: 2.5, height: 1.3, fitMode: "contain" },
        { type: "rule", x: 3.65, y: 3.55, width: 1.2, height: 0.022, background: "secondary" },
        {
          type: "text",
          field: "org:organizationName",
          x: 0.85, y: 3.95, width: 6.8, height: 2.1,
          fontRole: "display", color: "onPrimary", alignment: "center",
          textFit: "shrink", maxLines: 3,
          placeholder: "Your Organization",
        },
        {
          type: "text",
          field: "publicationLabel",
          x: 0.85, y: 6.25, width: 6.8, height: 0.4,
          fontRole: "eyebrow", color: "secondary", alignment: "center",
          textFit: "truncate",
        },
        {
          type: "text",
          field: "year",
          x: 0.85, y: 9.35, width: 6.8, height: 0.4,
          fontRole: "folio", color: "onPrimary", alignment: "center", opacity: 0.7,
        },
      ],
    },

    {
      /*
       * The listing spread.
       *
       * ── Page geometry ──
       *
       * Three profile cards across each page, two rows deep: six per page,
       * twelve across the spread. Laid out as TWO repeaters, one per page,
       * rather than one six-column grid spanning the sheet. A single grid can
       * only space its columns evenly, which would make the fold just another
       * column gap; two grids give the gutter its own generous margin and
       * guarantee no card ever crosses the centre fold.
       *
       *   outside margin   0.75in
       *   gutter margin    0.55in each side of the fold (1.10in across it)
       *   left page copy   x 0.75 -> 7.95
       *   right page copy  x 9.05 -> 16.25
       *   column width     (7.20 - 2 x 0.33) / 3 = 2.18in
       *   card height      (8.70 - 0.36) / 2    = 4.17in
       *   grid bottom      10.05in, clear of the folios at 10.25 and the
       *                    footer credit below them
       *
       * The two grids share one run of records: the left starts at index 0,
       * the right at index 6. See startIndex.
       */
      id: "listing-spread",
      pageType: "listing-spread",
      label: "Interior spread — listings",
      caption: "Twelve of your records placed into the template's profile grid.",
      form: "spread",
      background: `${DIR}/listing-spread-background.svg`,
      backgroundColor: "paper",
      elements: [
        /* Left page furniture */
        { type: "text", field: "role:grouping", x: 0.75, y: 0.72, width: 4.2, height: 0.3, fontRole: "eyebrow", color: "secondary", textFit: "truncate", placeholder: "Membership" },
        { type: "rule", x: 0.75, y: 1.1, width: 7.2, height: 0.014, background: "secondary", opacity: 0.5 },

        /* Right page furniture — the recto begins at 8.5in */
        { type: "text", field: "static:Directory", x: 9.05, y: 0.72, width: 4.2, height: 0.3, fontRole: "eyebrow", color: "secondary", textFit: "truncate" },
        { type: "rule", x: 9.05, y: 1.1, width: 7.2, height: 0.014, background: "secondary", opacity: 0.5 },

        /* Verso grid — records 1–6 */
        {
          type: "repeater",
          x: 0.75, y: 1.35, width: 7.2, height: 8.7,
          repeat: { columns: 3, rows: 2, gapX: 0.33, gapY: 0.36 },
          startIndex: 0,
          cell: PROFILE_CARD,
        },

        /* Recto grid — records 7–12 */
        {
          type: "repeater",
          x: 9.05, y: 1.35, width: 7.2, height: 8.7,
          repeat: { columns: 3, rows: 2, gapX: 0.33, gapY: 0.36 },
          startIndex: 6,
          cell: PROFILE_CARD,
        },

        { type: "text", field: "static:12", x: 0.75, y: 10.25, width: 1.0, height: 0.3, fontRole: "folio", color: "ink", opacity: 0.4, alignment: "left" },
        { type: "text", field: "static:13", x: 15.25, y: 10.25, width: 1.0, height: 0.3, fontRole: "folio", color: "ink", opacity: 0.4, alignment: "right" },
      ],
    },

    {
      /*
       * The featured-profile spread.
       *
       * Verso: one full-bleed portrait. Recto: the profile.
       *
       * ── Why the lower half is a stack ──
       *
       * The heading block (eyebrow, name, rule, role) is fixed — it should land
       * in the same place for every member, so a reader flicking through the
       * book sees a consistent page. Below it, the biography and the contact
       * details are genuinely sequential: the contact block belongs directly
       * under whatever the biography turned out to be.
       *
       * Anchoring the contact block near the foot of the page, as this
       * previously did, meant a member with a two-line biography got a hole in
       * the middle of their page. The stack collapses that: absent phone,
       * email, website and address lines take no space at all, and everything
       * below them flows up. The whitespace a short record leaves falls at the
       * FOOT of the page, where it reads as margin rather than as a mistake.
       *
       * ── Recto margins ──
       *
       *   inner  9.60in   (1.10in from the fold — deliberately deep for a
       *                    feature page, wider than the listing spread's 0.55)
       *   outer 16.25in   (0.75in outside margin, matching every other page and
       *                    aligning with the folio)
       */
      id: "profile-spread",
      pageType: "profile-spread",
      label: "Interior spread — featured profile",
      caption: "The profile treatment used for board members, staff and honorees.",
      form: "spread",
      background: `${DIR}/profile-spread-background.svg`,
      backgroundColor: "paper",
      elements: [
        /* Verso — a single large portrait, full bleed to the gutter. */
        { type: "image", field: "record:image", x: 0, y: 0, width: 8.5, height: 11, fitMode: "cover", background: "primary", placeholder: "portrait", recordIndex: 0 },

        /* Recto — fixed heading block. */
        {
          type: "text", field: "role:grouping",
          x: 9.6, y: 1.5, width: 6.65, height: 0.3,
          fontRole: "eyebrow", color: "secondary", textFit: "truncate",
          placeholder: "Featured Member", recordIndex: 0,
        },
        {
          type: "text", field: "personName",
          x: 9.6, y: 2.0, width: 6.65, height: 0.9,
          fontRole: "sectionTitle", color: "ink",
          textFit: "shrink", maxLines: 2, recordIndex: 0,
        },
        { type: "rule", x: 9.6, y: 3.1, width: 1.2, height: 0.022, background: "secondary" },
        {
          type: "text", field: "role:secondaryText",
          x: 9.6, y: 3.4, width: 6.65, height: 0.45,
          fontRole: "listingTitle", color: "secondary",
          textFit: "clamp", maxLines: 2, recordIndex: 0,
        },

        /*
         * Recto — flowing block. Biography first, then the contact group
         * immediately beneath it. Any child with no value is skipped and its
         * space reclaimed.
         */
        {
          type: "stack",
          x: 9.6, y: 4.15, width: 6.65, height: 5.75,
          gap: 0.07,
          groupGap: 0.36,
          recordIndex: 0,
          children: [
            {
              field: "role:bodyText",
              fontRole: "body", color: "ink",
              maxLines: 10, group: "bio",
              /* Gives up lines first if the whole stack would overrun. */
              flexible: true,
            },
            { field: "streetAddress", fontRole: "listingDetail", color: "ink", opacity: 0.75, maxLines: 2, group: "contact" },
            { field: "cityStateLine", fontRole: "listingMeta", color: "ink", opacity: 0.75, maxLines: 1, group: "contact" },
            { field: "role:phone", fontRole: "listingMeta", color: "ink", opacity: 0.75, maxLines: 1, group: "contact" },
            { field: "role:email", fontRole: "listingMeta", color: "ink", opacity: 0.75, maxLines: 1, group: "contact" },
            { field: "role:website", fontRole: "listingMeta", color: "ink", opacity: 0.75, maxLines: 1, group: "contact" },
          ],
        },

        { type: "text", field: "static:24", x: 15.25, y: 10.25, width: 1.0, height: 0.3, fontRole: "folio", color: "ink", opacity: 0.4, alignment: "right" },
      ],
    },
  ],
};
