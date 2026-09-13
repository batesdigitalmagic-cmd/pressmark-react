/*
 * What the studio sells, kept as data.
 *
 * These five services and this page-based rate are the only parts of the old
 * marketing site that survived the move to a tool-first homepage. They are
 * here, as plain data, rather than embedded in the pages that show them —
 * /services and /pricing state them, /contact's form offers the same
 * publication types, and a rate that changes should change in one place.
 */

export const SERVICES = [
  {
    title: "Yearbook automation",
    description:
      "Beautiful, organized yearbooks that celebrate students, teams, activities, achievements, and the moments people want to remember.",
  },
  {
    title: "Directory automation",
    description:
      "Professional directories designed for schools, churches, associations, nonprofits, membership groups, and community organizations.",
  },
  {
    title: "Data merge",
    description:
      "Automatically place portraits, names, grades, titles, and custom information across hundreds of pages with accuracy and consistency.",
  },
  {
    title: "Publication cleanup",
    description:
      "Already started the project? We organize files, repair layouts, fix formatting issues, and get everything back on track.",
  },
  {
    title: "Print-ready prepress",
    description:
      "Production-ready PDFs, bleeds, margins, image checks, file packaging, and commercial print preparation for confident delivery.",
  },
];

export const PUBLICATION_TYPES = [
  "School Yearbook",
  "Church Directory",
  "Association Directory",
  "Government Publication",
  "Annual Report",
  "Program / Event Book",
  "Data Merge",
  "Publication Cleanup",
  "Other / Not Sure",
];

export const BUDGET_RANGES = [
  "Under $1,000",
  "$1,000 - $2,500",
  "$2,500 - $5,000",
  "$5,000 - $10,000",
  "$10,000+",
  "Not sure yet",
];

/* Page-based pricing. Trim size does not affect the rate — a 5.5x8.5 page and
   an 8.5x11 page cost the same. Setup covers CSV-driven data merge and
   automation, which is lighter work on short books. */
export const SMALL_BOOK_MAX_PAGES = 25;
export const SETUP_FEE_SMALL = 250;
export const SETUP_FEE = 350;
export const PER_PAGE_RATE = 25;

export const setupFeeFor = (pages) => (pages < SMALL_BOOK_MAX_PAGES ? SETUP_FEE_SMALL : SETUP_FEE);
export const estimateTotal = (pages) => setupFeeFor(pages) + pages * PER_PAGE_RATE;
export const money = (amount) => `$${amount.toLocaleString("en-US")}`;

export const PRICING_EXAMPLES = [
  { label: "Event program", pages: 24 },
  { label: "Church directory", pages: 40 },
  { label: "School yearbook", pages: 80 },
  { label: "Large yearbook", pages: 120 },
  { label: "Multi-section publication", pages: 200 },
];
