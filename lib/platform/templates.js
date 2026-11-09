/*
 * The production template catalogue.
 *
 * Only templates a worker can actually run belong here. Adding one means a row
 * in this file plus the InDesign template and worker mapping — the dashboard,
 * the project form and the API read everything from this list.
 */

import { BRAND_COLORS } from "../../src/instant-proof/colors.js";
import { OPTIONAL_HEADERS, REQUIRED_HEADERS } from "../render-jobs/csv.js";

export const TEMPLATES = [
  {
    id: "directory-classic",
    category: "Contact Directories",
    name: "Directory Classic",
    description:
      "A formal, symmetrical listing directory: name, phone, email, address and family members, set alphabetically by last name.",
    thumbnail: "/proof-templates/directory-classic/listing-spread-background.svg",
    trimSize: { width: 5.5, height: 8.5, unit: "in" },
    csv: { required: REQUIRED_HEADERS, optional: OPTIONAL_HEADERS, templateUrl: "/csv-templates/directory-classic-template.csv", maxRows: Number(process.env.PRESSMARK_RENDER_MAX_ROWS) || 5000 },
    customization: BRAND_COLORS.map(({ key, label, hint }) => ({ key, label, hint })),
    /* Honest capability flags — the UI renders what is true here. */
    supports: { csv: true, photos: false, logo: false },
  },
];

export const templateById = (id) => TEMPLATES.find((template) => template.id === id) || null;
