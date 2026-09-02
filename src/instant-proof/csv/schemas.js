/*
 * Content schemas — the second of the three Phase 2 concepts.
 *
 *   Publication configuration  →  what the customer is making
 *   Content schema             →  which columns and assets that content needs   ← this file
 *   Design template            →  how the content is laid out on the page
 *
 * Deliberately six focused schemas rather than one universal CSV. A yearbook
 * roster and a sponsor list have almost nothing in common, and a single sheet
 * carrying every column of both would be mostly empty and hostile to fill in.
 *
 * `aliases` drive the column-mapping suggestions. They are *suggestions only* —
 * columnMapping.js never applies one without the customer confirming it, because
 * silently deciding that "Name" means `display_name` rather than `first_name`
 * would corrupt a whole publication invisibly.
 *
 * `role` tells the template renderer what a field is for without hardcoding
 * field names into templates: a template asks for the schema's `primaryText`
 * rather than for `display_name`, so one template works across schemas.
 */

/**
 * @typedef {object} SchemaField
 * @property {string} key        Canonical Pressmark column name.
 * @property {string} label      Human label used in the mapping UI.
 * @property {boolean} required
 * @property {string[]} aliases  Lowercased header spellings that suggest this field.
 * @property {string} [role]     Semantic role a template can bind to.
 * @property {string} [hint]
 */

/**
 * @typedef {object} ContentSchema
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} templateFile   Public path to the downloadable CSV.
 * @property {SchemaField[]} fields
 * @property {string} [imageField]   The column holding an image filename.
 */

/* Shared across schemas that carry an ordering column. */
const SORT_ORDER = {
  key: "sort_order",
  label: "Sort order",
  required: false,
  aliases: ["order", "sortorder", "sequence", "seq", "position", "rank", "#"],
  role: "sortOrder",
  hint: "Numeric. Controls the order records appear in.",
};

/** @type {ContentSchema[]} */
export const CONTENT_SCHEMAS = [
  {
    id: "people-directory",
    label: "People and Directory Records",
    description:
      "Members, families, staff, board or congregation listings with contact details and a photograph.",
    templateFile: "/csv-templates/pressmark-people-directory.csv",
    imageField: "photo_filename",
    fields: [
      { key: "record_id", label: "Record ID", required: true, aliases: ["id", "recordid", "member id", "memberid", "number", "no"], role: "recordId" },
      { key: "first_name", label: "First name", required: false, aliases: ["first", "firstname", "given name", "givenname", "fname"], role: "firstName" },
      { key: "last_name", label: "Last name", required: false, aliases: ["last", "lastname", "surname", "family name", "familyname", "lname"], role: "lastName" },
      { key: "display_name", label: "Display name", required: true, aliases: ["name", "member name", "membername", "full name", "fullname", "family name", "household", "listing name"], role: "primaryText" },
      { key: "title", label: "Title", required: false, aliases: ["job title", "jobtitle", "position", "role", "occupation", "job"], role: "secondaryText" },
      { key: "organization", label: "Organization", required: false, aliases: ["company", "employer", "business", "firm", "org"], role: "tertiaryText" },
      { key: "category", label: "Category", required: false, aliases: ["section", "group", "type", "department", "committee", "chapter"], role: "grouping" },
      { key: "address", label: "Address", required: false, aliases: ["street", "street address", "address 1", "address1", "mailing address"], role: "addressLine" },
      { key: "city", label: "City", required: false, aliases: ["town", "municipality"], role: "city" },
      { key: "state", label: "State", required: false, aliases: ["province", "region", "st"], role: "state" },
      { key: "postal_code", label: "Postal code", required: false, aliases: ["zip", "zipcode", "zip code", "postcode", "postal"], role: "postalCode" },
      { key: "phone", label: "Phone", required: false, aliases: ["telephone", "tel", "phone number", "phonenumber", "mobile", "cell", "home phone"], role: "phone" },
      { key: "email", label: "Email", required: false, aliases: ["e-mail", "email address", "emailaddress", "mail"], role: "email" },
      { key: "website", label: "Website", required: false, aliases: ["url", "web", "site", "homepage"], role: "website" },
      { key: "photo_filename", label: "Photo filename", required: false, aliases: ["photo", "image", "filename", "file name", "picture", "photo file", "photofile", "image filename", "headshot", "portrait"], role: "image", hint: "Must match an uploaded image filename exactly, including the extension." },
      { key: "short_bio", label: "Short bio", required: false, aliases: ["bio", "biography", "about", "description", "notes", "profile"], role: "bodyText" },
      SORT_ORDER,
    ],
  },

  {
    id: "yearbook-portraits",
    label: "Yearbook Portrait Records",
    description: "Student or staff portraits with grade, homeroom, group and quote.",
    templateFile: "/csv-templates/pressmark-yearbook-portraits.csv",
    imageField: "photo_filename",
    fields: [
      { key: "record_id", label: "Record ID", required: true, aliases: ["id", "recordid", "student id", "studentid", "number", "no"], role: "recordId" },
      { key: "first_name", label: "First name", required: false, aliases: ["first", "firstname", "given name", "fname"], role: "firstName" },
      { key: "last_name", label: "Last name", required: false, aliases: ["last", "lastname", "surname", "lname"], role: "lastName" },
      { key: "display_name", label: "Display name", required: true, aliases: ["name", "student name", "studentname", "full name", "fullname", "student"], role: "primaryText" },
      { key: "grade", label: "Grade", required: false, aliases: ["year", "class", "grade level", "gradelevel", "yr"], role: "secondaryText" },
      { key: "homeroom", label: "Homeroom", required: false, aliases: ["home room", "room", "section", "hr"], role: "tertiaryText" },
      { key: "teacher", label: "Teacher", required: false, aliases: ["instructor", "advisor", "adviser", "homeroom teacher"], role: "tertiaryText" },
      { key: "group_name", label: "Group name", required: false, aliases: ["group", "team", "club", "activity", "organization", "sport"], role: "grouping" },
      { key: "student_title", label: "Student title", required: false, aliases: ["title", "position", "role", "superlative", "award"], role: "secondaryText" },
      { key: "quote", label: "Quote", required: false, aliases: ["senior quote", "seniorquote", "saying", "motto"], role: "bodyText" },
      { key: "photo_filename", label: "Photo filename", required: false, aliases: ["photo", "image", "filename", "file name", "picture", "photo file", "portrait", "headshot"], role: "image", hint: "Must match an uploaded image filename exactly, including the extension." },
      SORT_ORDER,
    ],
  },

  {
    id: "editorial",
    label: "Editorial and Article Content",
    description: "Headlines, body copy, captions and pull quotes for feature and narrative pages.",
    templateFile: "/csv-templates/pressmark-editorial.csv",
    imageField: "image_filename",
    fields: [
      { key: "content_id", label: "Content ID", required: true, aliases: ["id", "contentid", "article id", "number", "no"], role: "recordId" },
      { key: "section", label: "Section", required: false, aliases: ["category", "chapter", "part", "department"], role: "grouping" },
      { key: "page_type", label: "Page type", required: false, aliases: ["pagetype", "layout", "template", "type"], role: "pageType" },
      { key: "headline", label: "Headline", required: true, aliases: ["title", "story title", "storytitle", "article title", "heading", "head"], role: "primaryText" },
      { key: "subheadline", label: "Subheadline", required: false, aliases: ["subhead", "sub headline", "subtitle", "deck", "standfirst"], role: "secondaryText" },
      { key: "body", label: "Body", required: false, aliases: ["text", "copy", "content", "story", "article", "body text", "bodytext"], role: "bodyText" },
      { key: "author", label: "Author", required: false, aliases: ["byline", "writer", "by", "contributor"], role: "tertiaryText" },
      { key: "caption", label: "Caption", required: false, aliases: ["photo caption", "cutline", "image caption"], role: "caption" },
      { key: "image_filename", label: "Image filename", required: false, aliases: ["image", "photo", "filename", "file name", "picture", "photo file", "main image"], role: "image", hint: "Must match an uploaded image filename exactly, including the extension." },
      { key: "secondary_image_filename", label: "Secondary image filename", required: false, aliases: ["second image", "image 2", "image2", "alt image", "supporting image"], role: "secondaryImage" },
      { key: "pull_quote", label: "Pull quote", required: false, aliases: ["pullquote", "quote", "callout", "highlight"], role: "pullQuote" },
      SORT_ORDER,
    ],
  },

  {
    id: "event-schedule",
    label: "Event Schedule Records",
    description: "Sessions, times, speakers and locations for programs and agendas.",
    templateFile: "/csv-templates/pressmark-event-schedule.csv",
    imageField: "image_filename",
    fields: [
      { key: "item_id", label: "Item ID", required: true, aliases: ["id", "itemid", "session id", "number", "no"], role: "recordId" },
      { key: "event_date", label: "Event date", required: false, aliases: ["date", "day", "session date"], role: "grouping" },
      { key: "start_time", label: "Start time", required: false, aliases: ["start", "time", "begins", "from"], role: "secondaryText" },
      { key: "end_time", label: "End time", required: false, aliases: ["end", "finish", "ends", "to", "until"], role: "tertiaryText" },
      { key: "title", label: "Title", required: true, aliases: ["session", "session title", "name", "event", "topic", "headline"], role: "primaryText" },
      { key: "speaker", label: "Speaker", required: false, aliases: ["presenter", "host", "performer", "artist", "lecturer", "name"], role: "tertiaryText" },
      { key: "speaker_title", label: "Speaker title", required: false, aliases: ["speaker role", "presenter title", "job title", "position", "credentials"], role: "caption" },
      { key: "location", label: "Location", required: false, aliases: ["room", "venue", "hall", "place", "stage"], role: "addressLine" },
      { key: "description", label: "Description", required: false, aliases: ["details", "summary", "abstract", "body", "about"], role: "bodyText" },
      { key: "image_filename", label: "Image filename", required: false, aliases: ["image", "photo", "filename", "file name", "picture", "headshot", "speaker photo"], role: "image", hint: "Must match an uploaded image filename exactly, including the extension." },
      { key: "sponsor_name", label: "Sponsor name", required: false, aliases: ["sponsor", "underwriter", "presented by", "partner"], role: "sponsor" },
      SORT_ORDER,
    ],
  },

  {
    id: "annual-report-metrics",
    label: "Annual Report Metrics",
    description: "Headline figures and impact statistics for report pages.",
    templateFile: "/csv-templates/pressmark-annual-report-metrics.csv",
    imageField: "image_filename",
    fields: [
      { key: "metric_id", label: "Metric ID", required: true, aliases: ["id", "metricid", "number", "no"], role: "recordId" },
      { key: "section", label: "Section", required: false, aliases: ["category", "area", "program", "chapter", "group"], role: "grouping" },
      { key: "value", label: "Value", required: true, aliases: ["figure", "number", "amount", "stat", "statistic", "total", "result"], role: "primaryText" },
      { key: "label", label: "Label", required: true, aliases: ["metric", "name", "title", "measure", "kpi", "caption"], role: "secondaryText" },
      { key: "description", label: "Description", required: false, aliases: ["details", "notes", "context", "summary", "body"], role: "bodyText" },
      { key: "year", label: "Year", required: false, aliases: ["fiscal year", "fy", "period", "reporting year"], role: "tertiaryText" },
      { key: "image_filename", label: "Image filename", required: false, aliases: ["image", "photo", "filename", "file name", "icon", "picture"], role: "image", hint: "Must match an uploaded image filename exactly, including the extension." },
      SORT_ORDER,
    ],
  },

  {
    id: "sponsors",
    label: "Sponsors and Advertisers",
    description: "Sponsor tiers, advertiser copy and supplied artwork.",
    templateFile: "/csv-templates/pressmark-sponsors.csv",
    imageField: "logo_filename",
    fields: [
      { key: "sponsor_id", label: "Sponsor ID", required: true, aliases: ["id", "sponsorid", "advertiser id", "number", "no"], role: "recordId" },
      { key: "organization_name", label: "Organization name", required: true, aliases: ["sponsor", "sponsor name", "company", "advertiser", "business", "name", "organization", "org"], role: "primaryText" },
      { key: "sponsor_level", label: "Sponsor level", required: false, aliases: ["level", "tier", "sponsorship level", "category", "package", "ad size"], role: "grouping" },
      { key: "headline", label: "Headline", required: false, aliases: ["tagline", "slogan", "title", "message", "ad headline"], role: "secondaryText" },
      { key: "description", label: "Description", required: false, aliases: ["details", "about", "copy", "body", "ad copy", "summary"], role: "bodyText" },
      { key: "website", label: "Website", required: false, aliases: ["url", "web", "site", "homepage"], role: "website" },
      { key: "logo_filename", label: "Logo filename", required: false, aliases: ["logo", "image", "filename", "file name", "logo file", "artwork"], role: "image", hint: "Must match an uploaded image filename exactly, including the extension." },
      { key: "ad_image_filename", label: "Ad image filename", required: false, aliases: ["ad", "ad image", "advertisement", "ad artwork", "full page ad"], role: "secondaryImage" },
      SORT_ORDER,
    ],
  },
];

/** @param {string} id @returns {ContentSchema|undefined} */
export const schemaFor = (id) => CONTENT_SCHEMAS.find((schema) => schema.id === id);

/** Canonical column names for a schema, in declaration order. */
export const columnsOf = (schema) => (schema?.fields ?? []).map((field) => field.key);

/** Required column names for a schema. */
export const requiredColumnsOf = (schema) =>
  (schema?.fields ?? []).filter((field) => field.required).map((field) => field.key);

/** Look a field up by its canonical key. */
export const fieldOf = (schema, key) => (schema?.fields ?? []).find((field) => field.key === key);

/**
 * Resolve a semantic role to the first field that provides it.
 * Templates bind to roles, not to column names, so one template can render
 * several schemas.
 */
export const fieldForRole = (schema, role) => (schema?.fields ?? []).find((field) => field.role === role);
