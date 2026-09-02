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
 *   { type: "pipeline", steps: [] } vertical flow diagram
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
  "Publication Production",
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
    slug: "microsoft-publisher-retiring-october-2026",
    featured: true,
    cluster: "production",
    category: "Publication Production",
    title: "Microsoft Publisher Is Retiring: How to Save Your Publications Before October 2026",
    seoTitle: "Microsoft Publisher Retiring in 2026: What to Do Now",
    metaDescription:
      "Microsoft Publisher retires in October 2026. Learn how to preserve your .pub files, choose a replacement and migrate important publications before access ends.",
    excerpt:
      "Publisher access is ending for Microsoft 365 customers. Here is a practical plan for finding, preserving, and rebuilding the publications your organization still depends on.",
    author: AUTHOR,
    publishedDate: "2026-08-28",
    updatedDate: "2026-08-28",
    readingTime: 9,
    featuredImage: "/publisher-retirement-2026.svg",
    featuredImageAlt:
      "Publisher Retirement 2026 graphic showing a PUB file moving to PDF and InDesign formats before an October deadline",
    relatedPosts: [
      "yearbook-print-ready-pdf-checklist",
      "what-is-indesign-data-merge",
      "bleed-trim-safe-area",
    ],
    content: [
      {
        type: "p",
        text: "For years, Microsoft Publisher has been the quiet production tool behind newsletters, church bulletins, school programs, directories, event flyers, certificates, menus, and other documents that have to be updated and printed again and again. In October 2026, that familiar workflow changes.",
      },
      {
        type: "p",
        text: "Microsoft has announced that Publisher will reach end of life in October 2026. Microsoft 365 subscribers will lose access to Publisher after October 1, 2026, which means they will no longer be able to open or edit Publisher files in the app. Support for perpetual Publisher 2021 installations ends October 13, 2026. The files do not erase themselves, but access to the software that understands them can become the problem.",
      },
      {
        type: "note",
        text: "The safest deadline is October 1, 2026. Finish your inventory, exports, and migration tests before that date—not during the final week.",
      },

      { type: "h2", text: "What Microsoft Publisher's retirement means" },
      {
        type: "p",
        text: "According to [Microsoft's official Publisher retirement guidance](https://support.microsoft.com/en-us/publisher/microsoft-publisher-will-no-longer-be-supported-after-october-2026), Publisher will no longer be included with Microsoft 365 after October 1. Subscribers will not be able to install, download, open, or edit publications with Publisher through that subscription. Organizations using a perpetual copy may still be able to run the installed application, but it will be outside support and will not receive security updates, bug fixes, or technical assistance after its support date.",
      },
      {
        type: "p",
        text: "That distinction matters. A PDF exported today will remain viewable in common PDF software. A native .pub file depends on Publisher or a conversion workflow that can interpret it. If the only useful copy of an annual booklet, membership directory, or branded template remains in .pub format, future access is tied to aging software and the computer where it still runs.",
      },
      {
        type: "p",
        text: "Retirement is therefore less about replacing an icon on the desktop and more about preserving institutional knowledge. The important assets may be page dimensions, master-page logic, text styles, linked pictures, mail-merge fields, print settings, or years of corrections that exist nowhere else.",
      },

      { type: "h2", text: "Start with a complete .pub file inventory" },
      {
        type: "p",
        text: "Do not begin by opening the first file you remember. Begin with an inventory. Search local computers, shared drives, OneDrive, SharePoint, archived project folders, removable drives, and old staff accounts for files ending in .pub. Microsoft specifically recommends searching for the .pub extension to locate Publisher documents.",
      },
      {
        type: "p",
        text: "Record enough information to make a migration decision instead of creating one large conversion pile:",
      },
      {
        type: "ul",
        items: [
          "Filename, folder location, owner, and the department that uses it",
          "Publication type, such as newsletter, directory, program, certificate, label, or brochure",
          "How often it is reused and the next known deadline",
          "Whether the file must remain editable or only needs to be preserved for reference",
          "Whether it uses linked images, custom fonts, mail merge, unusual page sizes, folds, bleeds, or commercial-print settings",
          "Whether the current file opens correctly and whether any links or fonts are already missing",
        ],
      },
      {
        type: "p",
        text: "Then sort the inventory into three groups: archive, recreate, and retire. Archive files only need a trustworthy visual record. Recreate files are active publications that must remain editable. Retire files are duplicates, obsolete drafts, and materials nobody should carry into the next system.",
      },

      { type: "h2", text: "Preserve every important publication before you migrate it" },
      {
        type: "p",
        text: "Before rebuilding anything, protect the source. Keep an untouched copy of each important .pub file and export a PDF that records how the publication looked while Publisher could still render it. The native file preserves the original structure; the PDF becomes the durable visual reference.",
      },
      {
        type: "ol",
        items: [
          "Open the original .pub file and confirm that every page displays correctly.",
          "Resolve missing fonts and linked images while the original production environment is still available.",
          "Export a PDF using Publisher's File > Export > Create PDF/XPS workflow, selecting an appropriate quality for print or screen use.",
          "Inspect the PDF page by page for overset text, substituted fonts, low-resolution pictures, transparency changes, missing objects, and incorrect page order.",
          "Package the .pub file, verified PDF, linked images, fonts you are licensed to retain, and a short notes file in one clearly named archive folder.",
          "Back up that archive in at least two managed locations and record who owns it.",
        ],
      },
      {
        type: "p",
        text: "Microsoft's [PDF and XPS export instructions](https://support.microsoft.com/en-us/publisher/save-as-or-convert-a-publication-to-pdf-or-xps-using-publisher) explain the built-in export process. For a large archive, Microsoft also points to PowerShell or other automation for bulk PDF conversion. Automation can save time, but a batch is not finished until representative files and every high-value publication have been visually checked.",
      },

      { type: "h2", text: "A PDF preserves appearance, not editability" },
      {
        type: "p",
        text: "PDF is the right preservation format when the goal is to view, approve, share, or reprint a finished publication. It is not a complete replacement for an editable layout. Text may be difficult to reflow, image crops may be flattened, master pages and style definitions are lost, and mail-merge logic does not survive as a reusable production system.",
      },
      {
        type: "p",
        text: "For an annual directory or weekly program, exporting a PDF solves only half the problem. The organization also needs a new source template that staff can update safely. Treat the PDF as the visual specification for that rebuild: it records size, margins, typography, page order, recurring elements, and the relationship between content and images.",
      },

      { type: "h2", text: "Choose the replacement by publication type" },
      {
        type: "p",
        text: "There is no universal one-click successor to Publisher. The best destination depends on who edits the document, how complex the pages are, whether data changes frequently, and how the finished piece is produced.",
      },
      { type: "h3", text: "Word or PowerPoint for simple office publications" },
      {
        type: "p",
        text: "Microsoft recommends Word or PowerPoint as starting points for many common Publisher projects. Word can work well for letters, labels, envelopes, forms, and text-forward newsletters. PowerPoint can be practical for posters, signs, certificates, cards, and simple one-page pieces where free placement matters more than long-document tools.",
      },
      {
        type: "p",
        text: "These options are familiar and widely available, but test them against the real job. A file that merely resembles the old layout is not successful if page breaks shift every month, volunteers cannot update it reliably, or the commercial printer cannot use the output.",
      },
      { type: "h3", text: "Adobe InDesign for production publications" },
      {
        type: "p",
        text: "InDesign is usually the stronger destination for multi-page publications, precise typography, reusable parent pages, linked images, professional PDF output, bleeds, spot colors, directories, catalogs, and data-driven layouts. It has a steeper learning curve than Publisher, but it provides a durable production system rather than a visual approximation.",
      },
      {
        type: "p",
        text: "Repeated rosters, staff listings, donor pages, product records, or membership directories may also benefit from [InDesign Data Merge](/blog/what-is-indesign-data-merge). Rebuilding the publication is an opportunity to separate content from layout so the next update is imported instead of manually retyped.",
      },
      { type: "h3", text: "A managed template for distributed teams" },
      {
        type: "p",
        text: "When many non-designers create local versions, the best answer may be a controlled template in an approved web-based design platform. Evaluate brand controls, accessibility, export quality, account ownership, privacy, archival access, and the cost of maintaining many users. Convenience alone is not a migration plan.",
      },

      { type: "h2", text: "Rebuild the system, not just the pages" },
      {
        type: "p",
        text: "A rushed migration often produces an editable copy that carries every weakness of the old file into a new application. A better rebuild identifies what should remain fixed and what should be easy to change. Logos, margins, typography, colors, page furniture, and print settings belong in the template. Dates, names, photographs, schedules, and issue-specific copy belong in a clear update workflow.",
      },
      {
        type: "ul",
        items: [
          "Create named paragraph, character, and object styles instead of formatting items one at a time.",
          "Use parent or master pages for recurring headers, folios, backgrounds, and guides.",
          "Store approved logos and images in a managed asset folder rather than embedding mystery copies.",
          "Document page size, bleed, color space, export presets, and printer requirements.",
          "Test the template with the staff member who will actually update it.",
          "Produce a short operating guide and name a responsible owner before handoff.",
        ],
      },
      {
        type: "p",
        text: "If the current document already has inconsistent styles, damaged links, improvised margins, or print problems, migration and [publication cleanup](/#services) should happen together. Recreating a broken workflow perfectly only preserves the breakage.",
      },

      { type: "h2", text: "A practical migration timeline" },
      {
        type: "h3",
        text: "Now: discover and prioritize",
      },
      {
        type: "p",
        text: "Find every .pub file, identify owners, mark active publications, and move the highest-risk recurring documents to the top. Confirm which Publisher license each workstation uses and whether the organization depends on Microsoft 365 access.",
      },
      { type: "h3", text: "Next: archive and test" },
      {
        type: "p",
        text: "Create verified PDFs and protected source archives. Select one representative document from each publication type and test the proposed replacement. Include real editors, real content, and the actual print or distribution process.",
      },
      { type: "h3", text: "Before October: rebuild and hand off" },
      {
        type: "p",
        text: "Rebuild active templates, validate output, train users, and document the workflow. Complete final Publisher exports while the application is still supported and accessible. Leave time for corrections; an October 1 deadline is not the day to discover that a ten-year archive uses a missing font.",
      },

      { type: "h2", text: "Microsoft Publisher retirement FAQ" },
      { type: "h3", text: "When does Microsoft Publisher retire?" },
      {
        type: "p",
        text: "Publisher for Microsoft 365 is available with its current functionality until October 1, 2026. Microsoft says subscribers will not be able to access Publisher after that date. Support for the perpetual Publisher version in Office LTSC 2021 and Consumer Office 2021 ends October 13, 2026.",
      },
      { type: "h3", text: "Will my .pub files disappear?" },
      {
        type: "p",
        text: "No. Retirement does not automatically delete files. The risk is losing a supported application that can open and edit them. Preserve the native files and export verified PDFs before access changes.",
      },
      { type: "h3", text: "Can I keep using a perpetual copy of Publisher?" },
      {
        type: "p",
        text: "Microsoft says a perpetual version may still be installed and used after support ends, but it will be unsupported. That can create security, compatibility, staffing, and hardware risks, so it should not be the only long-term access plan for important publications.",
      },
      { type: "h3", text: "Can PDF or InDesign open a .pub file directly?" },
      {
        type: "p",
        text: "A PDF reader cannot open a .pub file, and InDesign does not provide a dependable native .pub import workflow. Export a reference PDF from Publisher first, then rebuild important editable documents in the chosen destination. Conversion utilities may help recover content, but complex publications still require inspection and cleanup.",
      },
      { type: "h3", text: "What should we migrate first?" },
      {
        type: "p",
        text: "Start with documents that are business-critical, frequently reused, difficult to reconstruct, tied to an upcoming deadline, or dependent on special fonts, linked artwork, merge data, or commercial printing. Low-value duplicates can wait or be retired.",
      },

      { type: "h2", text: "Do not wait for the file you need to become the file you cannot open" },
      {
        type: "p",
        text: "Publisher's retirement is manageable when the work begins with enough time to inventory, preserve, test, and rebuild. It becomes expensive when an urgent program, directory, or newsletter is trapped in a format nobody prepared to replace.",
      },
      {
        type: "p",
        text: "Pressmark Studio can review your Publisher archive, identify high-risk files, create preservation PDFs, and rebuild priority publications as clean, reusable production templates.",
      },
      {
        type: "cta",
        label: "Request a Publisher Rescue Review",
        href: "/#contact",
      },
    ],
  },

  {
    slug: "batch-background-removal-photoshop-batchcutout-v1-2",
    cluster: "photoshop",
    category: "Photoshop Automation",
    title: "Batch Background Removal in Photoshop with BatchCutout v1.2",
    seoTitle: "Batch Background Removal Photoshop | BatchCutout v1.2",
    metaDescription:
      "Remove backgrounds from multiple photos in Photoshop, export transparent PNGs in bulk, and apply eleven cutout styles with BatchCutout v1.2.",
    excerpt:
      "One folder in, transparent PNGs out. A practical look at BatchCutout v1.2 for school portraits, yearbook production, sports graphics, and print-shop deadlines.",
    author: AUTHOR,
    publishedDate: "2026-08-16",
    updatedDate: "2026-08-16",
    readingTime: 10,
    featuredImage: "/batchcutout-styles.png",
    featuredImageAlt:
      "Eleven Pressmark BatchCutout v1.2 cutout styles shown on the Pressmark penguin mascot",
    relatedPosts: [
      "batch-remove-backgrounds-photoshop",
      "ai-batch-background-removal-photoshop",
      "automate-yearbook-pages-indesign-data-merge",
    ],
    content: [
      {
        type: "p",
        text: "It is Friday afternoon. You have 400 portraits from a school or church session, and every background has to be gone before layout starts Monday. If opening, cutting out, exporting, naming, and closing one photo takes three minutes, the folder represents 1,200 minutes of work. That is 20 hours before you place a single portrait on a page.",
      },
      {
        type: "p",
        text: "The problem is not whether Photoshop can remove one background. It can. The problem is repeating the same production sequence 399 more times while keeping the output consistent and leaving the original files alone.",
      },
      {
        type: "p",
        text: "Pressmark BatchCutout v1.2 is a Photoshop batch remove background script built for that folder, not for a one-photo demonstration. You choose how the backgrounds should be detected, choose an input folder and an output folder, and let the script work through the set. The results are transparent PNGs. The originals are never modified.",
      },

      { type: "h2", text: "What BatchCutout does" },
      {
        type: "p",
        text: "BatchCutout runs inside Adobe Photoshop 2021 or newer. Its basic job is deliberately simple: one folder in, transparent PNGs out. That makes it useful when the real requirement is to remove a background from multiple photos without turning every file into a separate manual task.",
      },
      {
        type: "p",
        text: "Choose the input folder that holds the portraits. Choose a separate output folder. BatchCutout isolates each subject and saves the result as a transparent PNG. Because it does not modify the source, the photographed originals remain available if a crop, colour correction, or different cutout treatment is needed later.",
      },
      {
        type: "p",
        text: "That separation matters in yearbook and print production. The cutouts can move into a publication layout while the source archive stays intact. It also makes bulk transparent PNG export predictable: the output folder contains the finished assets instead of a mixture of originals, working files, and exports.",
      },
      {
        type: "note",
        text: "If output PNGs already exist, BatchCutout skips them unless you change the filename suffix, choose an empty output folder, or turn on Overwrite existing PNGs.",
      },

      { type: "h2", text: "Three ways to detect the background" },
      {
        type: "p",
        text: "The right detection method depends on how the session was photographed. BatchCutout has three background modes so a controlled school setup does not have to be treated like a folder of mixed locations.",
      },
      { type: "h3", text: "Different / complex" },
      {
        type: "p",
        text: "This is the recommended mode and uses Photoshop's AI subject detection. It works on any backdrop, so it is the practical default when backgrounds vary, when the folder contains environmental portraits, or when you do not have one repeatable studio colour to target. It is the direct route when you need to automate Photoshop background removal across a set that is visually inconsistent.",
      },
      { type: "h3", text: "Mix of everything" },
      {
        type: "p",
        text: "Use Mix of everything when the folder itself is inconsistent. BatchCutout checks each file and picks the method automatically. The customer guide says to leave it here when you are not sure. That makes it suitable for a combined delivery assembled from more than one camera station or shooting day.",
      },
      { type: "h3", text: "Consistent solid color" },
      {
        type: "p",
        text: "Use Consistent solid color when every subject was photographed on the same studio backdrop. It is the fastest mode, and its purpose is matching edges across the set. The guide calls it the best choice for yearbook and product work.",
      },
      {
        type: "p",
        text: "Solid-color mode has one setting you are likely to adjust: Tolerance. Start at 28. If the cut reaches into hair or dark clothing, lower it and try 15. If background speckle survives, raise it and try 40. Those three numbers give you a useful test range without turning setup into another long job.",
      },

      { type: "h2", text: "Eleven cutout styles, grouped by the job they do" },
      {
        type: "p",
        text: "Background removal is only the first step for many production teams. Yearbook photo cutouts may need a paper edge. Sports graphics cutouts may need a hard shadow or team-colour halo. BatchCutout v1.2 includes eleven presets in three practical families. Each preset loads sensible defaults, but border, colour, shadow, and rough-edge values remain editable.",
      },
      { type: "h3", text: "Plain output" },
      {
        type: "p",
        text: "Clean Transparent PNG gives you the isolated subject with no border and no shadow. It is the default and the right choice when the layout, not the export script, will control the final treatment. Use it for portrait directories, clean yearbook grids, product placement, or any workflow that simply needs transparent files ready to place.",
      },
      { type: "h3", text: "Borders and shadows" },
      {
        type: "ul",
        items: [
          "White Sticker adds a white border around the subject. It is intended for collages.",
          "White Sticker + Shadow adds a soft drop shadow to that white border, lifting the subject off the page.",
          "Paper Cutout uses a thicker off-white border and a softer shadow for a scrapbook treatment.",
          "Floating Shadow has no border. A soft shadow underneath makes the subject sit on the page, which suits product shots and clean layouts.",
          "Pop Sticker combines a white border with a hard offset shadow and no blur. Its bold graphic finish is intended for sports graphics and social posts.",
          "Accent Glow places a coloured halo around the subject. Set the shadow colour to a team colour; a distance of zero spreads the glow evenly around the cutout.",
        ],
      },
      {
        type: "p",
        text: "These presets cover the common handoff between photography and design. A print shop can deliver neutral transparent PNGs. A yearbook designer can use Paper Cutout for a scrapbook spread. A sports designer can use Pop Sticker for a hard graphic edge or Accent Glow to carry a team colour into the portrait treatment.",
      },
      { type: "h3", text: "Rough-edge finishes" },
      {
        type: "ul",
        items: [
          "Spray Paint creates a ragged, tight speckle like spray paint or screen print. Raising Roughness makes the edge wilder.",
          "Torn Paper creates an irregular off-white edge with a soft shadow. It is the scrapbook look, but hand-torn rather than neatly trimmed.",
          "Rough Edge creates a subtle hand-cut edge for layouts where the border should look deliberate without becoming the main effect.",
          "Distressed Stamp breaks and erodes the border like worn ink, with patches removed from the edge.",
        ],
      },
      {
        type: "p",
        text: "The rough-edge presets add four controls. Roughness determines how far the ragged edge reaches. Grit controls the amount of noise from 1 to 400. Erosion above 128 eats the border away, while a value below 128 fattens it. Cleanup removes loose specks away from the edge; raise it to remove floating dots, lower it to preserve fine grain, or set it to zero to turn cleanup off.",
      },

      { type: "h2", text: "What changed in BatchCutout v1.2" },
      {
        type: "p",
        text: "Version 1.2 adds the eleven style presets and keeps the earlier workflow intact. Clean Transparent PNG remains the default, so a team upgrading from 1.0 can replace the script, restart Photoshop, and continue using the same plain-cutout process. The new styles are optional.",
      },
      {
        type: "ul",
        items: [
          "A 30-photo free trial with no card, no time limit, no watermark, and no feature limits",
          "An animated Pressmark penguin that works alongside the batch as each photo is cut",
          "Editable border width and colour, including White, Paper, Kraft, Black, or a typed hex value",
          "Editable shadow colour, opacity, blur, and distance, plus Exact colour for hard shadows and glows",
          "Roughness, Grit, Erosion, and Cleanup controls for the four rough-edge styles",
          "Automatic canvas padding calculated from border and shadow sizes so effects are not clipped at the frame edge",
        ],
      },
      {
        type: "p",
        text: "There is also a useful production safeguard. If a style fails on one image, that image still exports as a plain cutout and the run continues. One effect problem does not have to stop the rest of the folder.",
      },

      { type: "h2", text: "Worked example: 400 portraits for a yearbook deadline" },
      {
        type: "p",
        text: "Suppose all 400 portraits were photographed on the same studio backdrop and the yearbook layout needs clean transparent subjects. The shortest reliable workflow is:",
      },
      {
        type: "ol",
        items: [
          "Open BatchCutout from Photoshop's File > Scripts menu, or use File > Scripts > Browse and select the JSXBIN file.",
          "Choose Consistent solid color because the backdrop matches across the session.",
          "Leave Tolerance at the starting value of 28 and test representative portraits, including dark clothing and detailed hair.",
          "If the selection cuts into hair or clothing, lower Tolerance toward 15. If backdrop speckle remains, raise it toward 40.",
          "Choose Clean Transparent PNG so the yearbook layout controls the final styling.",
          "Choose the input folder containing the portraits, then choose a separate output folder.",
          "Run the folder and wait for the Done summary. The original portraits remain unchanged, and the output folder receives transparent PNGs.",
        ],
      },
      {
        type: "p",
        text: "If the creative direction changes, the same source set can be run again with Torn Paper for scrapbook spreads or Accent Glow for team pages. Because the originals were not altered, changing the finish does not require recovering or rebuilding the photography archive.",
      },
      {
        type: "p",
        text: "For a folder shot against varied locations instead, switch the first decision to Different / complex and let Photoshop's AI subject detection handle the backdrop. For a mixed delivery where some files share a backdrop and others do not, choose Mix of everything and let BatchCutout select the method per file.",
      },

      { type: "h2", text: "Try the complete workflow on 30 photos" },
      {
        type: "p",
        text: "BatchCutout v1.2 includes 30 free photos with no card and no time limit. The trial is not a reduced demo: all eleven cutout styles are available at full resolution with no watermark. That is enough to test the detection mode, edge quality, naming, output folder, and preferred style on files from your own session.",
      },
      {
        type: "p",
        text: "After the 30 photos, BatchCutout is $99 as a one-time purchase with no subscription. [Download the trial or buy BatchCutout v1.2](/buy), then test it on the kind of folder that currently consumes your production day.",
      },
      {
        type: "p",
        text: "If you want more background on the production problem first, read [how to remove backgrounds from hundreds of images in Photoshop](/blog/batch-remove-backgrounds-photoshop) and the deeper guide to [building a folder-level Photoshop background removal pipeline](/blog/ai-batch-background-removal-photoshop).",
      },
    ],
  },

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
        text: "A yearbook committee usually gathers photographs from a dozen sources: the portrait studio, students who take photos at games and events, three staff phones, a shared drive, the athletics department, and a parent who took better shots than anyone else. Design cannot start until those become one organised set.",
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

  {
    slug: "ai-batch-background-removal-photoshop",
    cluster: "photoshop",
    category: "Photoshop Automation",
    title:
      "From 1,000+ Images to Transparent PNGs: Building an AI Batch Background Removal Pipeline in Photoshop",
    seoTitle: "AI Batch Background Removal in Photoshop | Pressmark",
    metaDescription:
      "Turn Photoshop's AI background removal into an automated batch pipeline. Process folders of 1,000+ images into transparent PNGs instead of editing one by one.",
    excerpt:
      "AI background removal solved the image problem. It did not solve the production problem. Here is how to turn Photoshop into a folder-level pipeline that takes 1,000+ portraits to transparent PNGs without opening them one at a time.",
    author: AUTHOR,
    publishedDate: "2026-08-11",
    updatedDate: "2026-08-11",
    readingTime: 8,
    featuredImage: "/blog/ai-batch-background-removal-photoshop.jpg",
    featuredImageAlt:
      "Pipeline diagram showing a folder of portraits flowing through Pressmark BatchCutout and Photoshop AI into transparent PNGs ready for layout",
    relatedPosts: [
      "batch-remove-backgrounds-photoshop",
      "organize-yearbook-photos",
      "automate-yearbook-pages-indesign-data-merge",
    ],
    content: [
      {
        type: "p",
        text: "A folder lands on your desk. Inside are 1,240 portraits from three photo days, and every one of them needs its background removed before layout can start. The deadline is the same as it always was.",
      },
      {
        type: "p",
        text: "Photoshop will remove any single one of those backgrounds beautifully. That is not the hard part any more. The hard part is the other 1,239.",
      },
      { type: "h2", text: "The hidden problem with AI background removal" },
      {
        type: "p",
        text: "Adobe's subject selection and Remove Background have quietly become excellent. On a studio portrait they produce a clean edge in seconds, hair included. If you judge the technology on one image, it looks solved.",
      },
      {
        type: "p",
        text: "Then you look at what actually happens across a batch. For every single image, an operator repeats the same sequence:",
      },
      {
        type: "ol",
        items: [
          "Open the image",
          "Run Photoshop background removal",
          "Inspect the result",
          "Export a transparent PNG",
          "Name and file it correctly",
          "Close the document and move to the next one",
        ],
      },
      {
        type: "p",
        text: "Six steps, and only one of them is the clever bit. The AI handles the removal. Everything around it is unchanged from a decade ago, and all of it scales linearly with the size of the folder.",
      },
      {
        type: "note",
        text: "The quality problem is largely solved. The repetition problem is not. Those are different problems, and they need different tools.",
      },
      { type: "h2", text: "Why 1,000 images changes everything" },
      {
        type: "p",
        text: "A workflow that is merely tedious at 20 images becomes structurally impractical at 1,000. The arithmetic is unforgiving: at roughly a minute of human handling per image — opening, checking, exporting, naming, closing — a folder of 1,000 represents more than sixteen hours of production work.",
      },
      {
        type: "p",
        text: "That is two full working days in which nobody is designing anything. And it is two days of the least interesting work in the building, which is exactly where attention drifts and files get misnamed, skipped, or saved to the wrong folder.",
      },
      {
        type: "p",
        text: "The cost is not only time. It is the errors repetition produces — the student who ends up on the wrong page because their cutout was exported under last year's filename. Once photos are organised and named to match your roster those mistakes largely disappear; our guide on [organising yearbook photos before design begins](/blog/organize-yearbook-photos) covers the conventions that make it hold.",
      },
      {
        type: "p",
        text: "There is also a scheduling cost that rarely gets counted. Sixteen hours of handling cannot be parallelised across a team without splitting the folder, and splitting the folder introduces exactly the inconsistencies you were trying to avoid. So it usually falls to one person, in sequence, blocking everything downstream until it is finished.",
      },
      { type: "h2", text: "Introducing Pressmark BatchCutout" },
      {
        type: "p",
        text: "Pressmark BatchCutout is a Photoshop automation script built to take an entire folder of images through a repeatable background-removal and transparent-PNG export workflow.",
      },
      {
        type: "p",
        text: "You select the source folder and the output location, start the batch, and Photoshop processes the images through the automated pipeline. You do not open them one by one. You do not export them one by one. You point it at a folder and let it work.",
      },
      {
        type: "p",
        text: "Photoshop remains the image-processing engine throughout. BatchCutout does not replace it, reimplement it, or route your images through anything else. It automates the repetitive production workflow around it — turning a tool designed for individual edits into a scalable batch-production system.",
      },
      { type: "h2", text: "How the automated pipeline works" },
      {
        type: "pipeline",
        steps: [
          "1,000+ Original Images",
          "Pressmark BatchCutout",
          "Photoshop AI Background Removal",
          "Automatic Processing",
          "Transparent PNG Export",
          "Organized Output Folder",
          "Ready for Layout",
        ],
      },
      {
        type: "p",
        text: "The shape of the work changes. Instead of a person shepherding each file through six manual steps, the folder becomes the unit of work. Originals are left untouched and cutouts are written to a separate output location, so a batch that needs rerunning with different settings costs nothing but time.",
      },
      {
        type: "p",
        text: "A note on speed, because this is where automation tools tend to overpromise: actual throughput depends on your computer, your Photoshop version, image resolution, subject complexity, and how fast Adobe's own processing runs on your hardware. What automation reliably removes is the human interaction between images — the opening, exporting, naming, saving, and closing. That is the part costing you sixteen hours.",
      },
      { type: "h2", text: "AI background removal vs AI batch background removal" },
      {
        type: "p",
        text: "The distinction is worth stating plainly, because the two are constantly conflated.",
      },
      {
        type: "ul",
        items: [
          "AI background removal solves the image problem. It decides where the subject ends and the backdrop begins, and it does that job well.",
          "AI batch background removal solves the production problem. It decides how a thousand of those operations get sequenced, exported, named, and filed without a person driving each one.",
        ],
      },
      {
        type: "p",
        text: "Buying the first and hoping it addresses the second is the mistake. A perfect cutout engine with a manual workflow wrapped around it still costs two days per folder. Bulk background removal in Photoshop is not a better algorithm — it is a better loop around the algorithm you already have.",
      },
      { type: "h2", text: "Who this is built for" },
      {
        type: "p",
        text: "Anyone who receives images by the folder rather than by the file:",
      },
      {
        type: "ul",
        items: [
          "School portrait and yearbook photography departments",
          "Sports team, graduation, and event photographers",
          "Staff, membership, and church directory producers",
          "Product photography and ecommerce catalogue teams",
          "Graphic production departments and high-volume studios",
        ],
      },
      {
        type: "p",
        text: "The common thread is volume and repeatability. If your images arrive in the hundreds and need the same treatment applied consistently across all of them, the manual workflow is the bottleneck — not the software doing the cutouts.",
      },
      { type: "h2", text: "Why staying inside Photoshop matters" },
      {
        type: "p",
        text: "There are web services that will remove backgrounds in bulk. For production work they carry real costs: your client's portraits leave your machine, per-image pricing scales badly at volume, output quality is whatever the service decides that week, and you inherit an upload-and-download step that eats the time you were trying to save.",
      },
      {
        type: "p",
        text: "Staying inside Photoshop means the files never leave your system, the results match what your team already produces, colour management and export settings stay under your control, and the output drops straight into the layout tools you already use. It is Photoshop automation for high-volume production, not a detour around Photoshop.",
      },
      {
        type: "p",
        text: "There is a subtler benefit too: repeatability. A batch processed through the same script with the same settings produces the same edge treatment, the same canvas dimensions, and the same export profile across all 1,240 files. Consistency across a spread is what separates a professional book from one that looks assembled by six different people — and it is far easier to guarantee mechanically than by asking an operator to stay identical through hour fourteen.",
      },
      { type: "h2", text: "A production-scale workflow, end to end" },
      {
        type: "p",
        text: "Here is what a yearbook portrait run looks like once the pipeline is in place.",
      },
      {
        type: "ol",
        items: [
          "Photo day delivers 1,240 portraits, named to match the school roster",
          "The folder is checked for coverage and naming before anything is processed",
          "BatchCutout runs the folder through Photoshop and writes transparent PNGs to an output directory",
          "The cutouts are spot-checked as contact sheets rather than opened individually",
          "The PNGs flow into portrait pages automatically via InDesign Data Merge",
        ],
      },
      {
        type: "p",
        text: "Step five is where the compounding happens. Cutouts named to match your data can be placed across hundreds of pages without a designer touching a frame — see [automating yearbook pages with Data Merge](/blog/automate-yearbook-pages-indesign-data-merge). Background removal stops being a task and becomes one link in a production chain.",
      },
      {
        type: "p",
        text: "If you want the manual technique first, our guide to [batch background removal in Photoshop](/blog/batch-remove-backgrounds-photoshop) covers actions and the point at which they stop being enough.",
      },
      { type: "h2", text: "Stop processing images one at a time" },
      {
        type: "p",
        text: "AI background removal at production scale is not about a smarter cutout. It is about never opening the file in the first place. Turn Photoshop into a high-volume background-removal pipeline with [Pressmark BatchCutout](/buy).",
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
