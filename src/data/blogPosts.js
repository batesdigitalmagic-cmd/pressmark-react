/*
 * Pressmark Insights — the single source of truth for the blog.
 *
 * Everything downstream reads from here: the index page, every article page,
 * the category filter, related-post links, sitemap.xml, and the per-article
 * <head> tags baked into static HTML at build time by
 * scripts/generate-blog-pages.mjs.
 *
 * ── Adding an article ──
 * Append one object to POSTS and run `npm run build`. The page, its route,
 * its meta tags, its JSON-LD, and its sitemap entry are all generated. No
 * component needs touching.
 *
 * ── Content blocks ──
 * Body content is structured data, not HTML strings. That keeps the renderer
 * free of dangerouslySetInnerHTML, and lets the table of contents derive
 * itself from the h2/h3 blocks instead of parsing markup after the fact.
 *
 *   { type: "p",  text }            paragraph
 *   { type: "h2", text }            section heading (appears in the TOC)
 *   { type: "h3", text }            subheading (appears in the TOC, indented)
 *   { type: "ul", items: [] }       bullets
 *   { type: "ol", items: [] }       numbered steps
 *   { type: "note", text }          pulled-aside callout
 *
 * Inline links use [label](/href) inside any text. Keep them purposeful —
 * a link that isn't the natural next step for the reader is keyword stuffing
 * with extra steps.
 */

export const SITE_URL = "https://pressmark.studio";
export const BLOG_BASE = "/blog";
export const AUTHOR = "Pressmark Studio";

export const BLOG_META = {
  name: "Pressmark Insights",
  tagline: "Publication Design, Automation & Print Production Resources",
  intro:
    "Practical guides for creating better yearbooks, directories, publications, and production-ready files. Learn how smarter design systems, automation, data merge, and print-production workflows can save time and reduce costly mistakes.",
  heroSupport:
    "Explore practical strategies for designing, automating, preparing, and producing publications that have to be right.",
};

/* Order matters — this is the filter bar, left to right. */
export const CATEGORIES = [
  "All",
  "Yearbooks",
  "InDesign Automation",
  "Publication Design",
  "Print Production",
  "Photoshop Automation",
  "Directories",
];

/*
 * Topic clusters. Articles link within their cluster and to the adjacent one,
 * so authority concentrates instead of scattering:
 *
 *   Yearbooks → InDesign Automation → Print Production → Photoshop Automation
 */
export const CLUSTERS = {
  yearbooks: "Yearbooks",
  automation: "InDesign Automation",
  production: "Print Production",
  photoshop: "Photoshop Automation",
  directories: "Directories",
};

export const POSTS = [
  {
    slug: "automate-yearbook-pages-indesign-data-merge",
    featured: true,
    cluster: "automation",
    category: "InDesign Automation",
    title: "How to Automate Yearbook Pages with InDesign Data Merge",
    seoTitle:
      "How to Automate Yearbook Pages with InDesign Data Merge | Pressmark Studio",
    metaDescription:
      "Learn how to automate yearbook portrait pages and repetitive layouts using Adobe InDesign Data Merge, CSV data, and reusable publication templates.",
    excerpt:
      "Learn how structured CSV data, reusable layouts, and Adobe InDesign Data Merge can dramatically reduce the time required to build portrait pages, directories, sports pages, and other repetitive publication layouts.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 9,
    featuredImage: "/blog/automate-yearbook-pages-indesign-data-merge.jpg",
    featuredImageAlt:
      "Adobe InDesign Data Merge panel set up to place student portraits and names across yearbook pages",
    relatedPosts: [
      "what-is-indesign-data-merge",
      "organize-yearbook-photos",
      "yearbook-print-ready-pdf-checklist",
    ],
    content: [
      {
        type: "p",
        text: "A 200-page yearbook might contain 900 portraits. Placed by hand, that is roughly a week of dragging images into frames, retyping names, and checking that the third student in row four is actually who the caption says. Data Merge turns that week into an afternoon — and, more importantly, removes the class of mistake that only surfaces after the book is printed.",
      },
      {
        type: "p",
        text: "This guide covers the whole workflow: preparing the data, building the template, running the merge, and fixing what merges never get right on the first pass.",
      },
      { type: "h2", text: "What Data Merge actually does" },
      {
        type: "p",
        text: "Data Merge takes one InDesign layout and one spreadsheet, then produces a page per record. You design a single portrait cell — photo frame, name, grade — and mark which parts come from data. InDesign repeats that cell for every row in the file.",
      },
      {
        type: "p",
        text: "The critical point is that the layout stays a template. Change the caption typeface after the merge and you change it once, not 900 times. If you have never run one, start with [what Data Merge is and when to use it](/blog/what-is-indesign-data-merge).",
      },
      { type: "h2", text: "Step 1: Get the data right before you open InDesign" },
      {
        type: "p",
        text: "Almost every failed merge is a data problem wearing a design costume. Portraits arrive from a photographer with filenames like IMG_4471.jpg, the school sends a roster ordered by homeroom, and nothing joins the two together.",
      },
      { type: "h3", text: "The one column that matters most" },
      {
        type: "p",
        text: "Your CSV needs a column holding the image path, and InDesign requires that column header to begin with an @ symbol — @Photo, for example. Everything else is ordinary text: FirstName, LastName, Grade, Homeroom.",
      },
      {
        type: "note",
        text: "Use absolute paths, or keep the CSV in the same folder as the images and use relative ones. A merge that silently produces empty frames is nearly always a path problem, not a Data Merge problem.",
      },
      { type: "h3", text: "Clean before you merge, not after" },
      {
        type: "ul",
        items: [
          "Normalise capitalisation — MCDONALD and McDonald will both print exactly as typed",
          "Strip trailing spaces, which quietly break sorting and create false duplicates",
          "Decide how preferred names are handled before anyone lays out a page",
          "Confirm every row has a matching image file, and list the ones that don't",
        ],
      },
      {
        type: "p",
        text: "Our guide to [organising yearbook photos before design begins](/blog/organize-yearbook-photos) covers the file-naming conventions that make this step short.",
      },
      { type: "h2", text: "Step 2: Build one cell, not one page" },
      {
        type: "p",
        text: "Design a single portrait unit and get it genuinely finished: image frame with the right fitting behaviour, name, secondary line, and the spacing between them. Set the frame's fitting to Fill Frame Proportionally with Auto-Fit enabled, or portraits will arrive stretched.",
      },
      {
        type: "ol",
        items: [
          "Open the Data Merge panel and select your CSV as the data source",
          "Draw the image frame and drag the @Photo field into it",
          "Place the text fields, then style them with paragraph styles — never local formatting",
          "In Create Merged Document, set Records per Document Page to Multiple Record",
          "Set the grid spacing and margins, then preview before generating",
        ],
      },
      {
        type: "p",
        text: "Paragraph styles matter more here than anywhere else in the book. A merged document with local overrides is effectively un-editable at scale; with styles, a late request to reduce every name by half a point is one edit.",
      },
      { type: "h2", text: "Step 3: Expect to fix three things" },
      {
        type: "p",
        text: "A merge gets you to about ninety percent. The remaining ten is predictable, and knowing what it is means you can budget for it.",
      },
      { type: "h3", text: "Long names break the grid" },
      {
        type: "p",
        text: "Hyphenated surnames overflow their frame. Set the text frame to auto-size downward, or add a character style with a slight horizontal scale for the outliers. Do not solve this by resizing individual frames.",
      },
      { type: "h3", text: "Portrait crops are inconsistent" },
      {
        type: "p",
        text: "Photographers vary head size between sessions, so heads drift up and down the frame across a spread. This is where studios lose most of their time. If the portraits also need backgrounds removed or standardised, batch that step before the merge — [batch background removal in Photoshop](/blog/batch-remove-backgrounds-photoshop) covers doing it across hundreds of images at once.",
      },
      { type: "h3", text: "Absent students arrive late" },
      {
        type: "p",
        text: "Retake day always lands after layout has started. Keep the merged pages linked to the source data and re-run the merge rather than patching individual frames, so the book and the roster never diverge.",
      },
      { type: "h2", text: "When Data Merge is the wrong tool" },
      {
        type: "p",
        text: "Data Merge repeats one layout. It cannot make editorial decisions — it will not vary a spread because the tennis team only has six players, and it will not balance a page when one homeroom has 31 students and another has 12. For those, scripting or hand layout is the honest answer.",
      },
      {
        type: "p",
        text: "It is also the wrong tool when the data is genuinely dirty. Merging bad data produces a beautifully typeset book full of wrong names, and nobody notices until it is in students' hands.",
      },
      { type: "h2", text: "Getting the merged pages to press" },
      {
        type: "p",
        text: "Merged documents carry the same production requirements as any other book — bleed on full-page images, correct colour space, and adequate image resolution. Work through the [print-ready PDF checklist](/blog/yearbook-print-ready-pdf-checklist) before you export, and make sure images are [prepared correctly for yearbook printing](/blog/prepare-images-yearbook-printing).",
      },
      {
        type: "p",
        text: "If you would rather not build the whole workflow yourself, [see what we do](/#services) — data merge, portrait organisation, and production-ready delivery are the core of it.",
      },
    ],
  },

  {
    slug: "what-is-indesign-data-merge",
    cluster: "automation",
    category: "InDesign Automation",
    title: "What Is InDesign Data Merge and When Should You Use It?",
    seoTitle: "What Is InDesign Data Merge and When Should You Use It? | Pressmark Studio",
    metaDescription:
      "A plain explanation of Adobe InDesign Data Merge, what it automates, when it saves real time, and when a different approach will serve you better.",
    excerpt:
      "A plain-language explanation of what Data Merge does, the kinds of publications it suits, and the situations where reaching for it will cost you more time than it saves.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 6,
    featuredImage: "/blog/what-is-indesign-data-merge.jpg",
    featuredImageAlt:
      "Completed directory records generated automatically with Adobe InDesign Data Merge",
    relatedPosts: [
      "automate-yearbook-pages-indesign-data-merge",
      "create-photo-directory-from-csv",
      "organize-yearbook-photos",
    ],
    content: [
      {
        type: "p",
        text: "Data Merge is InDesign's built-in way of combining a layout with a spreadsheet. You build one design, point it at a data file, and InDesign produces a copy of that design for every row.",
      },
      { type: "h2", text: "What it is good at" },
      {
        type: "p",
        text: "Anything where the design stays constant and only the content changes: portrait grids, membership directories, name badges, certificates, mailing pieces, product listings, sponsor pages.",
      },
      {
        type: "ul",
        items: [
          "Hundreds or thousands of near-identical records",
          "Content that already exists in a spreadsheet or database export",
          "Layouts where consistency matters more than individual composition",
          "Publications that will be reissued annually with new data",
        ],
      },
      { type: "h2", text: "What it is not good at" },
      {
        type: "p",
        text: "Data Merge does not make judgements. It cannot decide that a section deserves a full-bleed opener, rebalance a ragged final row, or vary a template because one group is unusually small. Anything requiring editorial thinking still needs a designer.",
      },
      {
        type: "note",
        text: "The break-even point is roughly forty records. Below that, setting up clean data often takes longer than placing items by hand.",
      },
      { type: "h2", text: "The three pieces you need" },
      {
        type: "ol",
        items: [
          "A CSV or tab-delimited file, with image columns prefixed by @",
          "An InDesign template built with paragraph and object styles",
          "Images in a known location, named to match the data",
        ],
      },
      { type: "h2", text: "Where to go next" },
      {
        type: "p",
        text: "For a full worked example, read [how to automate yearbook pages with Data Merge](/blog/automate-yearbook-pages-indesign-data-merge). If your project is a membership or church directory rather than a yearbook, [building a photo directory from a CSV](/blog/create-photo-directory-from-csv) is the closer fit.",
      },
      {
        type: "p",
        text: "We handle data merge work as a service if the setup is more than you want to take on — [see our services](/#services).",
      },
    ],
  },

  {
    slug: "create-photo-directory-from-csv",
    cluster: "directories",
    category: "Directories",
    title: "How to Build a Photo Directory from a CSV File",
    seoTitle: "How to Build a Photo Directory from a CSV File | Pressmark Studio",
    metaDescription:
      "Build a church, school, or association photo directory from spreadsheet data using InDesign Data Merge, with reliable family grouping and consistent listings.",
    excerpt:
      "How to turn a membership spreadsheet and a folder of photographs into a properly organised directory — including the family-grouping problem that catches most people out.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 7,
    featuredImage: "/blog/create-photo-directory-from-csv.jpg",
    featuredImageAlt:
      "Two-page church directory spread with organised member photographs and contact information",
    relatedPosts: [
      "what-is-indesign-data-merge",
      "automate-yearbook-pages-indesign-data-merge",
      "prepare-images-yearbook-printing",
    ],
    content: [
      {
        type: "p",
        text: "Directories look simpler than yearbooks and are frequently harder. A yearbook has one record per student; a directory has households, and households do not fit neatly into spreadsheet rows.",
      },
      { type: "h2", text: "Decide the record shape first" },
      {
        type: "p",
        text: "Before any layout work, answer one question: is a record a person or a household? Everything downstream depends on it, and changing your mind halfway means rebuilding the data.",
      },
      {
        type: "ul",
        items: [
          "One row per household — simplest to merge, but individual members need a single combined field",
          "One row per person with a household ID — more flexible, but requires grouping logic before the merge",
        ],
      },
      { type: "h2", text: "Structure the spreadsheet" },
      {
        type: "ol",
        items: [
          "Give every household a unique ID that never changes between editions",
          "Keep names in separate columns and combine them at merge time, not before",
          "Add an @Photo column with the path to each household or member image",
          "Include a sort key column so alphabetising does not depend on display formatting",
        ],
      },
      {
        type: "note",
        text: "Add an explicit sort key. Sorting on a display field breaks the moment someone is listed as 'The Andersons' or 'Dr. and Mrs. Patel'.",
      },
      { type: "h2", text: "Handle the missing photographs" },
      {
        type: "p",
        text: "Every directory has members who did not attend photo sessions. Decide the treatment early — a neutral placeholder, a name-only listing, or a separate section — and put it in the data as a flag rather than fixing it during layout.",
      },
      { type: "h2", text: "Build and merge" },
      {
        type: "p",
        text: "Design one listing cell, style it with paragraph styles, and merge with Multiple Record enabled. The mechanics are the same as portrait pages — [the yearbook Data Merge walkthrough](/blog/automate-yearbook-pages-indesign-data-merge) covers them step by step.",
      },
      {
        type: "p",
        text: "Directories are a core part of what we produce, from data cleanup through to print-ready files. [See our directory work](/#services).",
      },
    ],
  },

  {
    slug: "organize-yearbook-photos",
    cluster: "yearbooks",
    category: "Yearbooks",
    title: "How Schools Can Organize Yearbook Photos Before Design Begins",
    seoTitle:
      "How Schools Can Organize Yearbook Photos Before Design Begins | Pressmark Studio",
    metaDescription:
      "A practical system for naming, sorting, and checking yearbook photographs before layout starts, so design time is not spent hunting for files.",
    excerpt:
      "Most yearbook delays are not design problems. They are photo problems. Here is the file structure and naming convention that prevents them.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 6,
    featuredImage: "/blog/organize-yearbook-photos.jpg",
    featuredImageAlt:
      "Spreadsheet data flowing into organised yearbook publication pages",
    relatedPosts: [
      "automate-yearbook-pages-indesign-data-merge",
      "prepare-images-yearbook-printing",
      "yearbook-layout-mistakes",
    ],
    content: [
      {
        type: "p",
        text: "A yearbook committee usually gathers photographs from a dozen sources: the portrait studio, three staff phones, a shared drive, the athletics department, and a parent who took better shots than anyone else. Design cannot start until those become one organised set.",
      },
      { type: "h2", text: "Name files so they sort themselves" },
      {
        type: "p",
        text: "Filenames should sort correctly in a plain alphabetical listing, because that is how every tool will present them.",
      },
      {
        type: "ul",
        items: [
          "Portraits: Grade_LastName_FirstName.jpg — 09_Alvarez_Maria.jpg",
          "Events: YYYY-MM-DD_Event_###.jpg — 2026-10-14_Homecoming_012.jpg",
          "Teams: Sport_Season_Level.jpg — Soccer_Fall_Varsity.jpg",
        ],
      },
      {
        type: "note",
        text: "Zero-pad every number. Without it, image 10 sorts before image 2, and a chronological event sequence arrives shuffled.",
      },
      { type: "h2", text: "One folder structure, agreed once" },
      {
        type: "ol",
        items: [
          "01 Portraits — one subfolder per grade",
          "02 Candids — one subfolder per event, dated",
          "03 Athletics — one subfolder per sport and season",
          "04 Clubs and Activities",
          "05 Staff and Faculty",
          "06 Rejected — never delete, just move here",
        ],
      },
      { type: "h2", text: "Check coverage before layout, not after" },
      {
        type: "p",
        text: "Build a simple checklist against the roster: every student appears at least once outside their portrait, every team has a photograph, every club is represented. Finding a missing group in week two is an inconvenience; finding it at press time is a reprint.",
      },
      {
        type: "p",
        text: "Once photographs are organised and named to match your roster, portrait pages can be [built automatically with Data Merge](/blog/automate-yearbook-pages-indesign-data-merge). We also take this on directly — [see how we help](/#services).",
      },
    ],
  },

  {
    slug: "yearbook-layout-mistakes",
    cluster: "yearbooks",
    category: "Yearbooks",
    title: "7 Common Yearbook Layout Mistakes and How to Avoid Them",
    seoTitle: "7 Common Yearbook Layout Mistakes and How to Avoid Them | Pressmark Studio",
    metaDescription:
      "The seven layout mistakes that most often show up in school yearbooks, why each one happens, and the design decisions that prevent them.",
    excerpt:
      "The same seven problems appear in yearbook after yearbook. Each is easy to avoid once you know what causes it — and expensive to fix after printing.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 7,
    featuredImage: "/blog/yearbook-layout-mistakes.jpg",
    featuredImageAlt: "Class of 2027 sophomore yearbook portrait spread",
    relatedPosts: [
      "organize-yearbook-photos",
      "bleed-trim-safe-area",
      "yearbook-print-ready-pdf-checklist",
    ],
    content: [
      {
        type: "p",
        text: "These are the problems we see most often in books that arrive for cleanup. None of them is a matter of taste — each has a concrete cause and a concrete fix.",
      },
      { type: "h2", text: "1. Content too close to the trim" },
      {
        type: "p",
        text: "Cutting varies by a millimetre or two across a print run. Names set close to the page edge lose their descenders on some copies and not others. Keep text well inside the safe area — see [bleed, trim and safe area explained](/blog/bleed-trim-safe-area).",
      },
      { type: "h2", text: "2. Content lost in the gutter" },
      {
        type: "p",
        text: "A thick book does not open flat. Faces placed across the centre of a spread disappear into the binding. Push important content away from the gutter, and never split a face across it.",
      },
      { type: "h2", text: "3. Inconsistent portrait scale" },
      {
        type: "p",
        text: "Heads drifting up and down across a grid is the fastest way to make a spread look amateur. Standardise crops before placement rather than nudging frames afterwards.",
      },
      { type: "h2", text: "4. Local formatting instead of styles" },
      {
        type: "p",
        text: "Manually formatted text means a late change becomes hundreds of edits. Paragraph and character styles make it one.",
      },
      { type: "h2", text: "5. Low-resolution images" },
      {
        type: "p",
        text: "A photo that looks fine on screen at 72 ppi prints soft. Check effective resolution at placed size, not native size — [preparing images for yearbook printing](/blog/prepare-images-yearbook-printing) covers the numbers.",
      },
      { type: "h2", text: "6. Unbalanced coverage" },
      {
        type: "p",
        text: "Some students appear six times, others once. This is a data problem, not a design one: track appearances against the roster as you go.",
      },
      { type: "h2", text: "7. Colour that shifts in print" },
      {
        type: "p",
        text: "Vivid on-screen colours flatten when converted for press. Work in the right colour space from the start — [RGB vs CMYK explained](/blog/rgb-vs-cmyk-print).",
      },
      {
        type: "p",
        text: "If a book has already gone wrong, publication cleanup is one of the things we do — [see our services](/#services).",
      },
    ],
  },

  {
    slug: "yearbook-print-ready-pdf-checklist",
    cluster: "production",
    category: "Print Production",
    title: "The Complete Yearbook Print-Ready PDF Checklist",
    seoTitle: "The Complete Yearbook Print-Ready PDF Checklist | Pressmark Studio",
    metaDescription:
      "Every check to run before sending a yearbook to press — bleed, colour space, resolution, fonts, overprint, and export settings that printers actually accept.",
    excerpt:
      "The checks worth running before a yearbook goes to press, in the order that catches the most expensive problems first.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 8,
    featuredImage: "/blog/yearbook-print-ready-pdf-checklist.jpg",
    featuredImageAlt: "Open printed yearbook showing a finished publication spread",
    relatedPosts: [
      "bleed-trim-safe-area",
      "rgb-vs-cmyk-print",
      "prepare-images-yearbook-printing",
    ],
    content: [
      {
        type: "p",
        text: "A press-ready PDF is not simply an export. Run these in order — the early checks catch the problems that cost reprints.",
      },
      { type: "h2", text: "Before you export" },
      {
        type: "ol",
        items: [
          "Run Preflight with a profile matching your printer's specification",
          "Resolve every missing or modified link in the Links panel",
          "Confirm no RGB or spot colours remain unless the printer expects them",
          "Check effective resolution on every placed image at final size",
          "Confirm all fonts are active and licensed for embedding",
          "Verify page count is divisible by the binding signature, usually 4 or 8",
        ],
      },
      { type: "h2", text: "Bleed and margins" },
      {
        type: "p",
        text: "Anything touching the page edge must extend at least 3 mm beyond the trim. Text should sit comfortably inside the safe area. If those terms are unfamiliar, start with [bleed, trim and safe area](/blog/bleed-trim-safe-area).",
      },
      { type: "h2", text: "Export settings" },
      {
        type: "ul",
        items: [
          "PDF/X-4 unless your printer specifies otherwise",
          "Marks and bleeds: include bleed, add crop marks only if requested",
          "Do not downsample images below 300 ppi",
          "Embed all fonts, subset below 100%",
          "Convert transparency only if the printer requires flattening",
        ],
      },
      { type: "h2", text: "After you export" },
      {
        type: "p",
        text: "Open the PDF and look at it. Use Output Preview to check separations, confirm blacks are not building from four plates where they should be single-channel, and page through at full size. A five-minute read of the exported file catches things preflight does not.",
      },
      {
        type: "note",
        text: "Send the printer a two-page sample before committing the full book. A specification mismatch found on page 2 is free; found on page 200 it is not.",
      },
      {
        type: "p",
        text: "We provide print-ready review as a standalone service if you would rather have a second pair of eyes — [see our services](/#services).",
      },
    ],
  },

  {
    slug: "bleed-trim-safe-area",
    cluster: "production",
    category: "Publication Design",
    title: "Bleed, Trim and Safe Area Explained for Print Publications",
    seoTitle: "Bleed, Trim and Safe Area Explained for Print Publications | Pressmark Studio",
    metaDescription:
      "What bleed, trim, and safe area mean in print production, how much of each you need, and what happens when a publication is set up without them.",
    excerpt:
      "Three terms every printer assumes you know. Here is what each one means, how much you need, and what goes wrong without them.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 5,
    featuredImage: "/blog/bleed-trim-safe-area.jpg",
    featuredImageAlt:
      "Publication page showing trim edge, bleed area, and safe margin for print",
    relatedPosts: [
      "yearbook-print-ready-pdf-checklist",
      "rgb-vs-cmyk-print",
      "yearbook-layout-mistakes",
    ],
    content: [
      {
        type: "p",
        text: "Printing happens on sheets larger than the finished page, then everything is cut down. These three terms describe that process, and getting them wrong is the most common reason a file gets sent back.",
      },
      { type: "h2", text: "Trim" },
      {
        type: "p",
        text: "The finished size of the page — where the blade cuts. An 8.5 × 11 in publication has a trim size of 8.5 × 11 in.",
      },
      { type: "h2", text: "Bleed" },
      {
        type: "p",
        text: "Artwork extended past the trim, usually by 3 mm or 0.125 in. Cutting is never perfectly accurate; bleed means a background that should reach the edge still does when the blade lands slightly inside the line. Without it you get a thin white sliver.",
      },
      { type: "h2", text: "Safe area" },
      {
        type: "p",
        text: "The margin inside the trim where important content belongs — normally 3–5 mm in. Anything closer risks being clipped. On bound publications, add extra on the spine side, because the gutter swallows more than you expect.",
      },
      {
        type: "note",
        text: "Bleed and safe area solve opposite halves of the same problem: bleed stops the page ending too early, safe area stops content ending too late.",
      },
      { type: "h2", text: "Setting it up" },
      {
        type: "p",
        text: "Set bleed when you create the document, not at export — retrofitting it means re-extending every edge-touching element by hand. Then work through the [print-ready PDF checklist](/blog/yearbook-print-ready-pdf-checklist) before sending.",
      },
    ],
  },

  {
    slug: "rgb-vs-cmyk-print",
    cluster: "production",
    category: "Print Production",
    title: "RGB vs CMYK: What Publication Designers Need to Know",
    seoTitle: "RGB vs CMYK: What Publication Designers Need to Know | Pressmark Studio",
    metaDescription:
      "Why colours look different on screen and in print, when to convert from RGB to CMYK, and how to avoid the colour shifts that surprise people at press.",
    excerpt:
      "Why the blue on your screen is not the blue on the page, when to convert, and how to keep colour predictable from layout through to press.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 6,
    featuredImage: "/blog/rgb-vs-cmyk-print.jpg",
    featuredImageAlt:
      "Colour-rich publication spread illustrating differences between screen and print colour",
    relatedPosts: [
      "prepare-images-yearbook-printing",
      "yearbook-print-ready-pdf-checklist",
      "bleed-trim-safe-area",
    ],
    content: [
      {
        type: "p",
        text: "Screens emit light; paper reflects it. That single difference explains nearly every colour surprise in print.",
      },
      { type: "h2", text: "The two models" },
      {
        type: "ul",
        items: [
          "RGB is additive — red, green and blue light combine towards white. It is what cameras capture and screens display.",
          "CMYK is subtractive — cyan, magenta, yellow and black inks absorb light. It is what presses lay down.",
        ],
      },
      { type: "h2", text: "Why some colours cannot survive" },
      {
        type: "p",
        text: "CMYK covers a smaller gamut than RGB. Saturated oranges, vivid greens and electric blues have no ink equivalent, so conversion maps them to the nearest printable colour — which is why a bright team colour can arrive muted.",
      },
      {
        type: "note",
        text: "If a school's brand colour is critical, ask the printer about a spot colour. It costs more and prints exactly.",
      },
      { type: "h2", text: "When to convert" },
      {
        type: "p",
        text: "Keep photographs in RGB while editing — you have more data to work with — and convert at export using the printer's profile. Set swatches for type and graphic elements in CMYK from the start, so a rich black is deliberate rather than accidental.",
      },
      { type: "h2", text: "Black is not one colour" },
      {
        type: "p",
        text: "Body text should be 100% K only. Four-colour black on small type produces visible registration fringing. Large solid areas benefit from a rich black build — ask your printer for their preferred values rather than inventing one.",
      },
      {
        type: "p",
        text: "Colour setup is part of the [print-ready checklist](/blog/yearbook-print-ready-pdf-checklist), and affects how you [prepare images](/blog/prepare-images-yearbook-printing).",
      },
    ],
  },

  {
    slug: "prepare-images-yearbook-printing",
    cluster: "yearbooks",
    category: "Yearbooks",
    title: "How to Prepare Images for High-Quality Yearbook Printing",
    seoTitle: "How to Prepare Images for High-Quality Yearbook Printing | Pressmark Studio",
    metaDescription:
      "Resolution, colour space, sharpening, and file format decisions that determine whether yearbook photographs print sharp or soft.",
    excerpt:
      "Resolution, colour, and sharpening decisions that separate photographs that print sharp from ones that arrive soft and muddy.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 6,
    featuredImage: "/blog/prepare-images-yearbook-printing.jpg",
    featuredImageAlt:
      "Publication images being reviewed and corrected for print production quality",
    relatedPosts: [
      "rgb-vs-cmyk-print",
      "batch-remove-backgrounds-photoshop",
      "yearbook-print-ready-pdf-checklist",
    ],
    content: [
      {
        type: "p",
        text: "Print is unforgiving in a way screens are not. A photograph that looks perfect at 100% on a monitor can print noticeably soft, and the reason is almost always resolution at placed size.",
      },
      { type: "h2", text: "Effective resolution is the number that matters" },
      {
        type: "p",
        text: "A 3000-pixel-wide image placed at 3 inches has an effective resolution of 1000 ppi — plenty. The same image stretched to 15 inches drops to 200 ppi and prints soft. InDesign's Links panel shows effective ppi; that is the figure to check, not the file's native size.",
      },
      {
        type: "ul",
        items: [
          "300 ppi at final placed size for photographs",
          "600 ppi or higher for line art and scanned logos",
          "Never upscale beyond about 120% of native resolution",
        ],
      },
      { type: "h2", text: "Sharpen last, and for the medium" },
      {
        type: "p",
        text: "Sharpening should be the final step, applied at the size the image will print. Print needs slightly more than screen, because ink spreads very slightly into paper fibres.",
      },
      { type: "h2", text: "Consistency across sources" },
      {
        type: "p",
        text: "Yearbook photographs arrive from studio cameras, phones, and parents. Match exposure and white balance across a spread before worrying about individual perfection — inconsistency reads as poor quality faster than any single soft image.",
      },
      {
        type: "p",
        text: "If portraits need backgrounds removed or standardised across hundreds of files, [batch processing in Photoshop](/blog/batch-remove-backgrounds-photoshop) is far quicker than working one at a time.",
      },
    ],
  },

  {
    slug: "batch-remove-backgrounds-photoshop",
    cluster: "photoshop",
    category: "Photoshop Automation",
    title: "How to Remove Backgrounds from Hundreds of Images in Photoshop",
    seoTitle:
      "How to Remove Backgrounds from Hundreds of Images in Photoshop | Pressmark Studio",
    metaDescription:
      "Batch background removal in Adobe Photoshop for portraits and product images, using actions, scripts, and consistent output settings.",
    excerpt:
      "Removing a background from one portrait takes a minute. Removing it from four hundred takes a system. Here is how to build one.",
    author: AUTHOR,
    publishedDate: "2026-08-10",
    updatedDate: "2026-08-10",
    readingTime: 7,
    featuredImage: "/blog/batch-remove-backgrounds-photoshop.jpg",
    featuredImageAlt:
      "Batch-processed portrait images with backgrounds removed for publication layout",
    relatedPosts: [
      "prepare-images-yearbook-printing",
      "automate-yearbook-pages-indesign-data-merge",
      "organize-yearbook-photos",
    ],
    content: [
      {
        type: "p",
        text: "Cutting out a single portrait is quick. The difficulty is doing it four hundred times with consistent edges, consistent margins, and no drift between the first image and the last.",
      },
      { type: "h2", text: "Start by sorting by background" },
      {
        type: "p",
        text: "Group images by shooting condition before processing anything. Portraits on an even studio backdrop need different settings from candids shot against a gymnasium wall, and one batch setting cannot serve both.",
      },
      { type: "h2", text: "Actions and batch processing" },
      {
        type: "ol",
        items: [
          "Record an action on a representative image — selection, refine edge, mask, canvas size, export",
          "Test it on ten images spanning the range, not just the easiest one",
          "Run File → Automate → Batch across the folder",
          "Review output as contact sheets rather than opening files individually",
        ],
      },
      {
        type: "note",
        text: "Always write to a new folder. A batch that goes wrong across originals is unrecoverable, and it never becomes obvious until image 300.",
      },
      { type: "h2", text: "Where actions stop being enough" },
      {
        type: "p",
        text: "Actions replay fixed steps. They cannot adapt a threshold per image, and hair against a busy background will defeat them. Mixed sources usually need scripting, or a tool built for the job.",
      },
      {
        type: "p",
        text: "That is exactly why we built [Pressmark BatchCutout](/buy) — batch background removal for Photoshop that handles solid backdrops and mixed backgrounds, exporting transparent PNGs ready to place.",
      },
      { type: "h2", text: "Then get them into the layout" },
      {
        type: "p",
        text: "Once cut out and named to match your roster, portraits can flow into pages automatically — see [automating yearbook pages with Data Merge](/blog/automate-yearbook-pages-indesign-data-merge).",
      },
    ],
  },
];

/* ── derived helpers, used by pages and the generator ── */

export const getPostBySlug = (slug) => POSTS.find((post) => post.slug === slug) || null;

export const getFeaturedPost = () => POSTS.find((post) => post.featured) || POSTS[0];

export const getPostsByCategory = (category) =>
  category === "All" ? POSTS : POSTS.filter((post) => post.category === category);

export const getRelatedPosts = (post) =>
  (post.relatedPosts || [])
    .map(getPostBySlug)
    .filter(Boolean)
    .slice(0, 3);

export const postUrl = (post) => `${BLOG_BASE}/${post.slug}`;
export const postAbsoluteUrl = (post) => `${SITE_URL}${postUrl(post)}`;

export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
