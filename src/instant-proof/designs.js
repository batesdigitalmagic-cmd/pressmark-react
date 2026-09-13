/*
 * The designs the tool offers, and which of them can actually be rendered.
 *
 * ── One flag decides everything ──
 *
 * `renderable` is the single fact that separates a design a customer can submit
 * from one they can only look at.
 *
 * `swatchKeys` is which of the six brand colours that design actually uses. The
 * template carries all six so a new design needs no swatch work, but Directory
 * Classic only paints three of them — offering a customer a control that moves
 * nothing is worse than not offering it. A design declares what it uses and the
 * panel shows exactly that.
 *
 * `previews` are two real exports of that design — one listing close enough to
 * read, and one whole spread at the size it prints. They are photographs of the
 * product rather than an impression of it, which is the only kind of preview
 * worth showing for something a customer will hand to a printer. The card, the button, the step rail and the
 * API's own allow-list all read from it, so a design cannot become half-enabled
 * by someone remembering to update one of the four.
 *
 * Directory with Photos is deliberately NOT renderable. There is no
 * InDesign template for it, no CSV-plus-photo contract and no worker
 * configuration, and a second render path that pretended otherwise would fail
 * in production on a customer's real directory. It exists here as a preview so
 * the library reads as a library, and so the work it needs is visible.
 */

export const DESIGNS = [
  {
    id: "directory-classic",
    name: "Directory Classic",
    status: "Available now",
    renderable: true,
    description: "A clean, text-based member directory generated from your CSV.",
    /*
     * Three, not six. In church-directory-classic.indd these are the swatches
     * actually applied to something: PM_Primary on the paragraph border under
     * each name, PM_Text on the body copy, PM_Background on the master spread.
     * Secondary, accent and tint exist in the template for designs still to
     * come, and this one would not move if they changed.
     */
    swatchKeys: ["primaryColor", "textColor", "backgroundColor"],
    thumbnail: "/proof-templates/directory-classic/thumbnail.png",
    previews: [
      {
        src: "/proof-templates/directory-classic/preview-listing.png",
        alt: "Two directory listings close up: a surname and given name in bold with a leader dotted across to the phone number, then alternate phone, two email addresses, the address, and the family members.",
        caption: "A listing, close up",
      },
      {
        src: "/proof-templates/directory-classic/preview-spread.png",
        alt: "A full spread of the classic directory: two columns of fourteen listings across facing 5.5 by 8.5 inch pages, each separated by a grey rule.",
        caption: "A full spread, as it prints",
      },
    ],
    /* Headers only. The customer fills in their own rows. */
    templateCsv: "/csv-templates/directory-classic-template.csv",
    templateFilename: "directory-classic.csv",
  },
  {
    id: "directory-photos",
    name: "Directory with Photos",
    status: "Coming soon",
    renderable: false,
    description: "A photo-led directory design for member portraits and contact information.",
    /* The intended set for this design. Nothing can be submitted against it yet,
       so this is a statement of intent rather than a live contract. */
    swatchKeys: [
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "textColor",
      "backgroundColor",
      "lightTint",
    ],
    thumbnail: "/proof-templates/photo-gallery/thumbnail.svg",
    previews: [
      {
        src: "/proof-templates/directory-photos/preview-listing.jpg",
        alt: "One photo directory listing close up: a name, office address, two phone numbers, two email addresses and a college, set beside a portrait photograph.",
        caption: "A listing, close up",
      },
      {
        src: "/proof-templates/directory-photos/preview-spread.jpg",
        alt: "A full spread of the photo directory: two columns of three portrait listings across facing 5.5 by 8.5 inch pages, each with a member photograph.",
        caption: "A full spread, as it prints",
      },
    ],
    templateCsv: "",
    templateFilename: "",
  },
];

export const DEFAULT_DESIGN_ID = "directory-classic";

export const designFor = (id) => DESIGNS.find((design) => design.id === id) ?? DESIGNS[0];

/** @returns {boolean} whether this design can be submitted for a render today. */
export const isRenderable = (id) => Boolean(designFor(id).renderable);

/** The brand colours this design exposes, in BRAND_COLORS order. */
export const swatchKeysFor = (id) => designFor(id).swatchKeys ?? [];
