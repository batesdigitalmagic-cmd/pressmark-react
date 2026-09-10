/*
 * Pressmark Instant Proof — publication configuration.
 *
 * Every publication type the tool supports is described here as data. The
 * upload step, the review summary and the mock renderer all read from these
 * objects, so adding a tenth publication type means adding one entry to
 * PUBLICATION_CONFIGS — no component changes, no new form.
 *
 * `requiredContent` / `optionalContent` drive the upload slots. `dataFields`
 * documents the CSV columns the automation reads and is shown to the customer
 * so they can prepare a spreadsheet that merges cleanly.
 */

/** @typedef {import('./models.js').PublicationConfiguration} PublicationConfiguration */

/* WebP matters on mobile: modern Android photo libraries hand it back by
   default, and rejecting it would look like the upload was broken. */
const IMAGES = [".jpg", ".jpeg", ".png", ".webp"];
const DATA = [".csv"];
const DOCS = [".pdf", ".docx"];

/* Every extension the tool accepts anywhere, for the <input accept> fallback
   and the "we accept" line in the UI. */
export const ACCEPTED_EXTENSIONS = [...IMAGES, ...DATA, ...DOCS];

/* Guard rails for an in-browser demo. Nothing is transmitted in Phase 1, but a
   visitor dropping a 400 MB folder would still exhaust the tab's memory. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 40;

/* Reusable requirement builders — the same slot appears across several
   publication types with different wording, and defining them as functions
   keeps the ids stable for metrics. */
const portraits = (hint) => ({
  id: "portraits",
  label: "Portrait photographs",
  hint,
  accept: IMAGES,
  required: true,
});

const roster = (label, hint) => ({
  id: "roster",
  label,
  hint,
  accept: DATA,
  required: true,
});

const logo = (label = "Organization logo") => ({
  id: "logo",
  label,
  hint: "PNG or JPG. A transparent PNG reproduces best.",
  accept: IMAGES,
  required: false,
});

const candids = {
  id: "candids",
  label: "Candid photographs",
  hint: "Optional. Event, activity or classroom photos.",
  accept: IMAGES,
  required: false,
};

const copyDoc = (label, hint) => ({
  id: "copy",
  label,
  hint,
  accept: [...DOCS, ...DATA],
  required: false,
});

/** @type {PublicationConfiguration[]} */
export const PUBLICATION_CONFIGS = [
  {
    id: "yearbook",
    schemaIds: ["yearbook-portraits"],
    label: "Yearbook",
    blurb: "Portraits, classes, teams and activities.",
    description:
      "A school or program yearbook built from portrait sets and a name roster, with section hierarchy and consistent page styles.",
    requiredContent: [
      portraits("10–30 portraits. Name the files to match your roster where possible."),
      roster("Student name CSV", "Columns such as First Name, Last Name, Grade, Photo File."),
    ],
    optionalContent: [logo("School logo"), candids],
    suggestedProofPages: 6,
    dataFields: ["First Name", "Last Name", "Grade / Class", "Homeroom", "Photo File"],
    uploadInstructions:
      "Send a slice of a real class — ten to thirty portraits and the matching name list. The proof shows how your full book would flow.",
    sampleOutput: "A cover, a portrait spread and a section divider spread.",
  },
  {
    id: "church-directory",
    /* Directory Classic's own schema — the eight merge fields of
       church-directory-classic.indd, and nothing the template cannot place. */
    schemaIds: ["church-directory"],
    label: "Church Directory",
    blurb: "Families, households and congregation contacts.",
    description:
      "A church photo directory built from family photographs and a household list, organized alphabetically with clear contact blocks.",
    requiredContent: [
      portraits("10–30 family or individual photographs."),
      roster(
        "Family and contact CSV",
        "Exactly these columns: last_name, first_name, address, phone, email, plus optional alternate_phone, alternate_email and family_members."
      ),
    ],
    optionalContent: [logo("Church logo"), candids],
    suggestedProofPages: 6,
    dataFields: [
      "last_name",
      "first_name",
      "address",
      "phone",
      "email",
      "alternate_phone",
      "alternate_email",
      "family_members",
    ],
    uploadInstructions:
      "Ten to thirty families is enough. The proof shows the listing layout, the alphabetical flow and the contact hierarchy.",
    sampleOutput: "A cover, a family listing spread and a section divider spread.",
  },
  {
    id: "membership-directory",
    schemaIds: ["people-directory"],
    label: "Membership Directory",
    blurb: "Members, categories and contact details.",
    description:
      "A membership directory built from a member list, organized by category with a consistent listing style throughout.",
    requiredContent: [
      portraits("10–30 member photographs."),
      roster("Member CSV", "Columns such as Name, Title, Category, Phone, Email."),
    ],
    optionalContent: [logo(), copyDoc("Introduction or welcome copy", "Optional. DOCX or PDF.")],
    suggestedProofPages: 6,
    dataFields: ["Name", "Title", "Category", "Phone", "Email", "Photo File"],
    uploadInstructions:
      "Send a representative slice of your membership. The proof shows the listing style and how categories are separated.",
    sampleOutput: "A cover, a member listing spread and a category divider spread.",
  },
  {
    id: "association-directory",
    schemaIds: ["people-directory"],
    label: "Association Directory",
    blurb: "Chapters, committees and professional listings.",
    description:
      "An association directory built from a member or chapter list, with committee sections and a professional listing hierarchy.",
    requiredContent: [
      portraits("10–30 member or board photographs."),
      roster("Member or chapter CSV", "Columns such as Name, Organization, Chapter, Role, Contact."),
    ],
    optionalContent: [logo("Association logo"), copyDoc("Committee or chapter copy", "Optional. DOCX or PDF.")],
    suggestedProofPages: 6,
    dataFields: ["Name", "Organization", "Chapter", "Role", "Phone", "Email", "Photo File"],
    uploadInstructions:
      "Ten to thirty listings is enough to demonstrate the structure across chapters or committees.",
    sampleOutput: "A cover, a listing spread and a chapter divider spread.",
  },
  {
    id: "event-program",
    schemaIds: ["event-schedule", "sponsors"],
    label: "Event Program",
    blurb: "Schedules, speakers and sponsors.",
    description:
      "An event program built from a schedule and speaker list, with sponsor placement and a clear running order.",
    requiredContent: [
      {
        id: "schedule",
        label: "Event schedule",
        hint: "CSV, DOCX or PDF. Times, sessions and rooms.",
        accept: [...DATA, ...DOCS],
        required: true,
      },
      {
        id: "speakers",
        label: "Speaker information",
        hint: "Names, titles and short biographies. CSV, DOCX or PDF.",
        accept: [...DATA, ...DOCS],
        required: true,
      },
    ],
    optionalContent: [
      { id: "sponsors", label: "Sponsor logos", hint: "Optional. PNG or JPG.", accept: IMAGES, required: false },
      { id: "photos", label: "Sample photographs", hint: "Optional. Venue, past events or speakers.", accept: IMAGES, required: false },
      logo("Event or organization logo"),
    ],
    suggestedProofPages: 4,
    dataFields: ["Time", "Session", "Speaker", "Title", "Room", "Sponsor Tier"],
    uploadInstructions:
      "A single day of the schedule plus a handful of speakers is plenty. The proof shows the running order and sponsor treatment.",
    sampleOutput: "A cover, a schedule spread and a speaker spread.",
  },
  {
    id: "annual-report",
    schemaIds: ["editorial", "annual-report-metrics"],
    label: "Annual Report",
    blurb: "Narrative, statistics and impact.",
    description:
      "An annual report built from narrative copy and figures, with a statistics treatment and an editorial page hierarchy.",
    requiredContent: [
      copyDoc("Sample article text", "DOCX or PDF. One or two sections is enough."),
      {
        id: "statistics",
        label: "Statistics",
        hint: "CSV or DOCX. Figures you want highlighted.",
        accept: [...DATA, ...DOCS],
        required: true,
      },
    ],
    optionalContent: [
      { id: "photos", label: "Organization photographs", hint: "Optional. JPG or PNG.", accept: IMAGES, required: false },
      logo(),
    ],
    suggestedProofPages: 4,
    dataFields: ["Metric", "Value", "Change", "Category", "Note"],
    uploadInstructions:
      "One narrative section and your headline figures. The proof shows the editorial layout and how statistics are set.",
    sampleOutput: "A cover, an editorial spread and a statistics spread.",
  },
  {
    id: "commemorative-book",
    schemaIds: ["people-directory", "editorial"],
    label: "Commemorative Book",
    blurb: "Honorees, tributes and timelines.",
    description:
      "A commemorative or tribute book built from honoree information and photographs, with a timeline or tribute structure.",
    requiredContent: [
      {
        id: "honorees",
        label: "Honoree information",
        hint: "CSV, DOCX or PDF. Names, years and short descriptions.",
        accept: [...DATA, ...DOCS],
        required: true,
      },
      { id: "photos", label: "Photographs", hint: "10–30 JPG or PNG files.", accept: IMAGES, required: true },
    ],
    optionalContent: [
      copyDoc("Timeline or tribute text", "Optional. DOCX or PDF."),
      logo(),
    ],
    suggestedProofPages: 6,
    dataFields: ["Honoree", "Year", "Role", "Tribute", "Photo File"],
    uploadInstructions:
      "A handful of honorees with their photographs. The proof shows the tribute layout and timeline treatment.",
    sampleOutput: "A cover, a tribute spread and a timeline spread.",
  },
  {
    id: "community-publication",
    schemaIds: ["people-directory", "editorial"],
    label: "Community Publication",
    blurb: "Neighborhood, civic and municipal books.",
    description:
      "A community publication built from listings, articles and photographs, organized into navigable sections.",
    requiredContent: [
      {
        id: "listings",
        label: "Listings or article copy",
        hint: "CSV, DOCX or PDF.",
        accept: [...DATA, ...DOCS],
        required: true,
      },
      { id: "photos", label: "Photographs", hint: "10–30 JPG or PNG files.", accept: IMAGES, required: true },
    ],
    optionalContent: [logo(), candids],
    suggestedProofPages: 4,
    dataFields: ["Name", "Category", "Address", "Phone", "Description", "Photo File"],
    uploadInstructions:
      "A representative section of listings or one article with photographs is enough to show the structure.",
    sampleOutput: "A cover, a listing spread and a feature spread.",
  },
  {
    id: "other",
    schemaIds: ["people-directory"],
    label: "Other Publication",
    blurb: "Not listed? Send what you have.",
    description:
      "A publication proof built from whatever content you have. Tell us the goal in the design notes and we will structure the sample around it.",
    requiredContent: [
      {
        id: "content",
        label: "Sample content",
        hint: "Any mix of JPG, PNG, CSV, PDF or DOCX.",
        accept: ACCEPTED_EXTENSIONS,
        required: true,
      },
    ],
    optionalContent: [logo(), copyDoc("Supporting copy", "Optional. DOCX or PDF.")],
    suggestedProofPages: 4,
    dataFields: ["Name", "Category", "Detail"],
    uploadInstructions:
      "Send a slice of the real content. Use the design notes in the previous step to tell us what the publication needs to do.",
    sampleOutput: "A cover and two interior spreads.",
  },
];

/** Content schemas recommended for a publication type, in download order. */
export const schemaIdsFor = (publicationTypeId) =>
  PUBLICATION_CONFIGS.find((c) => c.id === publicationTypeId)?.schemaIds ?? [];

/** @param {string} id @returns {PublicationConfiguration|undefined} */
export const configFor = (id) => PUBLICATION_CONFIGS.find((c) => c.id === id);

/*
 * Visual directions.
 *
 * As of Phase 2 these are FILTER METADATA, not the design itself — the actual
 * layout comes from a design template in templates/registry.js, and each
 * template declares which of these categories it belongs to. Keeping them lets
 * a customer narrow a long template list by the feel they are after.
 */
export const STYLE_DIRECTIONS = [
  {
    id: "clean",
    label: "Clean and Professional",
    blurb: "Generous white space, restrained rules, quiet typography.",
    swatches: ["#1f3a5f", "#5b7fa6", "#e8edf3"],
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "Inter, 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "bold",
    label: "Bold and Modern",
    blurb: "Strong headlines, high contrast, confident color blocks.",
    swatches: ["#0f1c2e", "#d64933", "#f2c14e"],
    headingFont: "Inter, 'Helvetica Neue', Arial, sans-serif",
    bodyFont: "Inter, 'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "traditional",
    label: "Traditional and Elegant",
    blurb: "Classical serif type, fine rules, formal symmetry.",
    swatches: ["#3d2b1f", "#aa7d48", "#f5efe6"],
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Cormorant Garamond', Georgia, serif",
  },
  {
    id: "youthful",
    label: "Youthful and Energetic",
    blurb: "Bright accents, dynamic photo crops, playful structure.",
    swatches: ["#1b998b", "#ff6b6b", "#ffd166"],
    headingFont: "Inter, 'Helvetica Neue', Arial, sans-serif",
    bodyFont: "Inter, 'Helvetica Neue', Arial, sans-serif",
  },
];

export const styleFor = (id) => STYLE_DIRECTIONS.find((s) => s.id === id);

/* Trim sizes Pressmark actually produces. Page rate does not vary by trim —
   see the pricing note in App.jsx. */
export const PUBLICATION_SIZES = [
  "8.5 x 11 in (letter)",
  "5.5 x 8.5 in (half letter)",
  "9 x 12 in",
  "6 x 9 in",
  "7 x 10 in",
  "Square, 8.5 x 8.5 in",
  "Not sure yet",
];

export const DEADLINE_WINDOWS = [
  "Within 30 days",
  "1–2 months",
  "3–4 months",
  "5–6 months",
  "More than 6 months",
  "No fixed deadline yet",
];

export const PAGE_COUNT_RANGES = [
  "Under 24 pages",
  "24–48 pages",
  "48–80 pages",
  "80–120 pages",
  "120–200 pages",
  "More than 200 pages",
  "Not sure yet",
];
