# Authoring a Pressmark proof template

How to take a design you have built in InDesign and make it available in
Instant Proof at `/instant-proof`.

A template exists in **two halves that must stay in step**:

| Half | Lives in | Used by |
| --- | --- | --- |
| Browser proof | `src/instant-proof/templates/<id>.js` + artwork in `public/proof-templates/<id>/` | The prospect's on-screen sample |
| Production document | Your `.indd` file, kept in the Pressmark template library | The real publication, and Phase 3's server render |

The browser half is a **flattened approximation** of the production half. It has
to look like the real thing to a prospect; it does not have to *be* the real
thing. Keep them visually aligned and the promise you make on screen stays a
promise you can keep in print.

---

## 1. Design the template in InDesign

Build the real thing first — the browser manifest is transcribed from it, not
the other way around.

- Work at the trim size you intend to sell. The shipped templates are 8.5 × 11 in;
  a spread is two of those, 17 × 11 in.
- Set the document's **units to inches** (`⌘R` / `Ctrl+R`, right-click a ruler).
  Every number you will transcribe is read straight off the geometry panel.
- Separate the layout into two layers:
  - **Background** — everything fixed: rules, panels, ornaments, borders,
    section furniture. Nothing here changes between customers.
  - **Variable** — every frame that will receive customer content: names,
    titles, photographs, the logo, the organization name, folios.
- Build the variable frames on a grid. Repeated cells (a portrait grid, a listing
  grid) must be **evenly spaced** — the manifest expresses them as one repeater
  with a column/row count and a gap, not as forty individual frames.
- Use paragraph and character styles for everything. Those become `fontRoles`.
- Use **swatches named by role**, not by color: `Primary`, `Secondary`, `Paper`,
  `Ink`. The customer's brand colors are substituted into those roles.

## 2. Export the background artwork

Hide the variable layer. Export **only the background**.

- `File → Export → PNG` (or WebP via `Export As` in recent versions).
- Export the **spread** for spread pages and the **page** for single pages, so
  the exported image matches the coordinate space the manifest uses.
- 96–150 DPI is plenty. This is a screen preview inside a container that is at
  most ~1000px wide; a 300 DPI export is several megabytes for no visible gain.
- **WebP is preferred** — roughly half the bytes of PNG at the same quality.
  Use PNG only when the artwork needs true transparency that WebP handles badly.
- Keep each file under ~250 KB. Three page backgrounds plus a thumbnail load on
  every visit to the style step.

Also export a **thumbnail** at 4:5 (e.g. 320 × 400) showing the cover. This is
what a customer clicks in the template selector.

## 3. Add the artwork to the template folder

```
public/proof-templates/
  <template-id>/
    thumbnail.webp
    cover-background.webp
    listing-spread-background.webp
    profile-spread-background.webp
```

The folder name is the template's `id`. File names are arbitrary — the manifest
names them explicitly — but keeping the `<page-id>-background` convention makes
the pairing obvious.

> **Replace the placeholders.** Every file currently in
> `public/proof-templates/directory-classic/` and
> `public/proof-templates/yearbook-modern/` is generated placeholder art,
> stamped "PRESSMARK PLACEHOLDER ARTWORK — REPLACE". They exist so the system is
> demonstrable end to end. Swapping in real exports needs no code change beyond
> updating the file extension in the manifest.

## 4. Define the variable elements in the manifest

Copy `src/instant-proof/templates/directory-classic.js` as a starting point and
register it in `registry.js`:

```js
import { myTemplate } from "./my-template.js";
export const DESIGN_TEMPLATES = [directoryClassic, yearbookModern, myTemplate];
```

That is the only wiring step. The selector, the preview dialog, the planner and
the renderer all read from the registry.

### Coordinates — one system, two boxes

**Every `x`, `y`, `width` and `height` is in inches from the top-left of the box
that contains the element.** Select a frame in InDesign, read X/Y/W/H, type the
same four numbers. No conversion.

There are exactly two kinds of box:

| Element | Measured from |
| --- | --- |
| A page-level element | the top-left of the **page** — on a spread, the full 17 in sheet, so a frame on the recto starts at x ≥ 8.5 |
| An element inside a `repeater`'s `cell` | the top-left of **that cell** — a cell element at `y: 2.6` is 2.6 in below the top of its own card, not of the page |

Cell size is derived, never declared:

```
cellWidth  = (repeater.width  - gapX × (columns - 1)) / columns
cellHeight = (repeater.height - gapY × (rows - 1))    / rows
```

`src/instant-proof/render/geometry.js` is the single implementation of this —
`frame()`, `pt()`, `cellBox()` and `pageBox()`. Every renderer component takes
one `box` and uses it for position, size and type size alike. A missing or
malformed box throws; it does not silently produce `NaN` percentages, which
browsers discard without complaint.

> **Type size depends on the container.** Sizes are declared in points and
> emitted as `cqw`, which resolves against the nearest ancestor carrying
> `container-type: inline-size`. Any box whose type is scaled by its own width
> must therefore *be* a query container. `containerStyle()` is the only way a box
> is opened, so the two cannot drift apart. Page and cell both use it.

### Element types

| `type` | Purpose | Key properties |
| --- | --- | --- |
| `text` | A text frame | `fontRole`, `color`, `alignment`, `textFit`, `maxLines`, `placeholder` |
| `image` | A picture frame | `fitMode` (`cover` \| `contain`), `background`, `radius` |
| `block` | A filled rectangle | `background`, `opacity` |
| `rule` | A hairline (a thin block) | `background`, `opacity` |
| `repeater` | A grid of record cells | `repeat: {columns, rows, gapX, gapY}`, `cell: [...]`, `startIndex` |

A `repeater`'s `cell` elements are positioned **relative to the cell box**, not
to the page — a cell element at `x: 0, y: 0` sits in the cell's top-left corner.

### Binding content

An element's `field` says where its content comes from:

| Binding | Resolves to |
| --- | --- |
| `role:primaryText` | The schema field carrying that role — see below |
| `column:display_name` | A specific canonical column |
| `org:organizationName` | A field from the organization step |
| `record:image` | The photograph matched to this record |
| `logo` | The customer's uploaded logo |
| `year` | The current year |
| `publicationLabel` | The publication type's name |
| `contactBlock` | Composite: address, city/state/zip, phone, email |
| `static:Some Text` | A literal |

**Bind to roles, not column names, wherever you can.** `role:primaryText` gets
`display_name` from a directory schema and `display_name` from a yearbook
roster; `column:grade` only ever works for a yearbook. Role binding is what lets
one template serve several content schemas. Roles are declared per field in
`src/instant-proof/csv/schemas.js`.

### Colors and type

Elements name a **color role** — `primary`, `secondary`, `paper`, `ink`,
`onPrimary` — never a hex value. `primary` and `secondary` are replaced by the
customer's chosen brand colors; the rest fall back to the template's
`defaultColors`. This is what makes the proof look like *their* publication.

`fontRoles` mirrors your InDesign paragraph styles. Sizes are in **points**, and
the renderer scales them against the page width, so a 44 pt headline stays
proportionally correct at every preview size.

### Overflow

Real customer data contains a hyphenated surname three times longer than
anything in your mockup. Every text element must declare `textFit`:

- `truncate` — one line, ellipsis. Folios, eyebrows, labels.
- `clamp` — up to `maxLines`, ellipsis on the last. Body copy, contact blocks.
- `shrink` — steps the type size down until it fits, then clamps. Display type
  where a smaller headline beats a truncated organization name.

Set `maxRecordsPerPage` and `overflow` on the template so the planner knows how
much of a long roster the sample should carry.

### The footer credit

Each template declares `footerMark: { text: "Pressmark Studio" }`. The renderer
places it centred in the footer margin, flipping to light type on dark pages
(any page whose `backgroundColor` is `primary` or `ink`). Keep the outer edges
of the footer free for folios — the credit takes the centre.

Leave a **clear footer margin of at least 0.4 in** at the bottom of every
background export so the credit has somewhere to sit.

## 5. Keep a production InDesign template alongside it

The browser proof is a sales instrument. The `.indd` file is what actually
produces the book, and Phase 3 will drive it through the InDesign Data Merge or
Custom Scripts API.

Keep them paired:

- Same trim size, same margins, same grid.
- Paragraph style names matching the manifest's `fontRole` keys.
- Swatch names matching the color roles.
- Data-merge placeholders named for the **canonical schema columns**
  (`<<display_name>>`, `<<photo_filename>>`), so the same CSV drives both halves.
- Store the `.indd`, its links and its fonts as a packaged folder in the
  template library, versioned alongside the manifest.

When the two drift, the browser proof starts promising a layout production
cannot deliver. That is the failure mode this pairing exists to prevent.

## 6. Checklist

- [ ] InDesign document at the intended trim, units in inches
- [ ] Background and variable content on separate layers
- [ ] Repeated cells evenly spaced on a real grid
- [ ] Paragraph styles and role-named swatches
- [ ] Background exported per page/spread, WebP, under ~250 KB
- [ ] 4:5 thumbnail exported
- [ ] Files in `public/proof-templates/<id>/`
- [ ] Manifest created, coordinates transcribed from the geometry panel
- [ ] Every text element declares a `textFit`
- [ ] Bound to roles rather than column names wherever possible
- [ ] Registered in `registry.js`
- [ ] Production `.indd` packaged and versioned alongside it
