# Pressmark Directory Merge for Adobe InDesign

`PressmarkDirectoryMerge.jsx` is a local Adobe InDesign desktop script. It opens the recurring production template, validates and attaches a CSV, creates a merged InDesign document, and exports a PDF. It never saves changes into the selected source template.

Use `church-directory-classic.indd` as the production template. Keep `church-directory-classic.idml` only as a portable backup.

## Install the script

1. Open Adobe InDesign.
2. Choose **Window > Utilities > Scripts** to open the Scripts panel.
3. In the panel, right-click on Windows or Control-click on macOS the **User** folder or a script inside it, then choose **Reveal in Explorer** or **Reveal in Finder**. This reveals the user **Scripts Panel** folder.
4. Copy `PressmarkDirectoryMerge.jsx` into that folder. It may be placed inside a `Pressmark` subfolder for organization.
5. Return to InDesign. The script should appear in the Scripts panel; refresh or reopen the panel if needed.

Adobe documents the user script locations as:

- macOS: `Users/[username]/Library/Preferences/Adobe InDesign/[version]/[language]/Scripts/Scripts Panel`
- Windows: `Users\[username]\AppData\Roaming\Adobe\InDesign\[version]\[language]\Scripts\Scripts Panel`

## Run the first merge

1. Close `church-directory-classic.indd` if it is already open. This safety check prevents the script from discarding unrelated unsaved edits.
2. Double-click `PressmarkDirectoryMerge.jsx` in the Scripts panel.
3. Select the production template: `church-directory-classic.indd`.
4. Select the data source: `church-directory-classic.csv`.
5. Select an output folder.
6. If an earlier output PDF exists, confirm whether it may be replaced.
7. Wait for the success dialog, then inspect the merged document that InDesign leaves open.

The CSV must contain these exact headers:

```text
last_name
first_name
address
phone
alternate_phone
email
alternate_email
family_members
```

A UTF-8 byte-order mark on the first header is accepted and removed for validation. The source CSV itself is not changed.

## Expected output

The selected output folder receives:

- `church-directory-classic-proof.pdf` — the completed merged PDF.
- `PressmarkDirectoryMerge.log` — timestamped steps, chosen files, PDF preset, and any error.
- `church-directory-classic-overset-report.txt` — InDesign's merge overset report when InDesign has overset conditions to report.

The newly created merged InDesign document remains open and unsaved for visual inspection. The source `.indd` is closed without saving. When available, PDF export uses `[High Quality Print]`. If that named preset is unavailable, the script reports and logs the installed preset it uses; if no preset exists, it uses InDesign's current PDF export preferences.

## Brand colour swatches (required for customer colours)

When a job carries customer colours, the script recolours the named swatches in
the document before merging. **They must already exist in
`church-directory-classic.indd` and in the `.idml`.** The script recolours them;
it never creates them.

| Swatch | Site field | Used for | In the template today |
| --- | --- | --- | --- |
| `PM_Primary` | `primaryColor` | Headings, mastheads, section rules | C0 M0 Y0 K100 |
| `PM_Secondary` | `secondaryColor` | The supporting colour beside the primary | C0 M70 Y100 K0 |
| `PM_Accent` | `accentColor` | Dividers, borders, small marks | C18 M42 Y100 K0 |
| `PM_Text` | `textColor` | Body copy | C0 M0 Y0 K100 |
| `PM_Background` | `backgroundColor` | The page ground | C0 M0 Y0 K0 |
| `PM_LightTint` | `lightTint` | Banding and shaded panels | C100 M90 Y10 K20 |

The right-hand column is what the site shows as each control's starting value —
it is read from the `.idml`, not guessed. If you change a swatch in the
template, update `BRAND_COLORS` in `src/instant-proof/colors.js` to match, or
the page will offer a starting colour the PDF does not actually contain.

### A design uses a subset, and only offers that subset

All six swatches live in the template so a new design needs no swatch work. A
design does not have to paint with all of them, and Directory Classic does not:

| Design | Swatches it paints |
| --- | --- |
| Directory Classic | `PM_Primary` (the paragraph border under each name), `PM_Text` (body copy), `PM_Background` (the master spread) |
| Directory with Photos | all six, once it exists |

Each design declares its own list in `swatchKeys`, in `src/instant-proof/designs.js`,
and the colour panel shows exactly those. A control that moves nothing in the
finished PDF is worse than no control at all — so when you start painting with
`PM_Accent` in a design, add the key there and the control appears.

Requirements, all enforced at render time:

- The names must match exactly, including the capital letters and underscores.
- Each must be **CMYK** and **Process** — not RGB, not Spot, not a tint or a
  mixed ink. A spot colour has a different colour model and is refused rather
  than converted, because silently converting one would hide a real production
  problem from the only person who can fix it.
- Every element whose colour a customer should be able to change must be
  **applied** one of these swatches, including strokes and paragraph rules.
  Anything coloured with a one-off swatch — or with `Black` — keeps its own
  colour for ever, however the customer sets the controls.
- `[Paper]`, `[Black]`, `[Registration]` and `[None]` are never touched.

If a swatch named in a job is missing or is the wrong kind, the render fails
with a message naming it. It does not fall back to the template's colours,
because a PDF in the wrong colours is worse than a clear failure.

### Only what changed is sent

The site submits a swatch **only when the customer actually changes it**. A
render where nobody touched the colours modifies nothing at all, and a customer
who changes one colour changes one colour.

That is not just tidiness. The hex-to-CMYK conversion is lossy in the direction
that matters here: `PM_LightTint` at C100 M90 Y10 K20 becomes `#0014B8` on
screen, and converting that back lands on C100 M89 Y0 K28 — close, but not what
you set.
Leaving untouched swatches alone means the values you built stay exactly as you
built them.

### How the colour reaches InDesign

The site validates each hex value, the worker converts it to four whole CMYK
percentages, and it arrives in the handoff file as one line per swatch:

```
swatch.PM_Primary=0,75,57,52
swatch.PM_LightTint=0,0,0,10
```

The swatch is named in the key, so this script keeps no list of its own — adding
a seventh colour to the site needs no change here, only a swatch in the
template. The names come from the site's own allow-list and never from anything
a customer typed.

The conversion is a plain device conversion with no ICC profile, so what is
printed depends on the document's own CMYK working space. Set that deliberately
in the template.

### The per-job copy

In job mode the worker copies the `.indd` into the job's temporary directory and
gives the script the copy. Recolouring is a document modification, and the
production template must never be the file that gets modified. Linked graphics
still resolve because InDesign stores an absolute path alongside the relative
one; a template whose links are stored relative-only should have them embedded.

## Troubleshooting

### Missing fields

- Read the alert and `PressmarkDirectoryMerge.log`; every missing required header is listed.
- Confirm the first row uses the exact underscored names above, without spelling changes.
- Confirm the file is a comma-separated `.csv`, not an Excel workbook renamed to `.csv`.
- After changing headers, confirm the Data Merge placeholders in `church-directory-classic.indd` correspond to the new source fields.

### Overset text

- Inspect `church-directory-classic-overset-report.txt` and the merged document's Preflight panel.
- Look for red plus signs on text frames.
- Correct unusually long CSV values or adjust the production template's frame size, paragraph style, tracking, or fitting rules. Run the merge again; do not repair only the generated document if the issue can recur.

### Brand colour failures

- *"The template has no colour swatch named ..."* — add it to the `.indd` and
  the `.idml`, as a CMYK process swatch, with the exact `PM_` name.
- *"... is not a CMYK swatch"* or *"... is not a process swatch"* — open
  Swatch Options and change the colour mode to CMYK and the type to Process.
- The colours applied but nothing looked different — those elements are coloured
  with something other than the `PM_` swatches. Select them and apply the right
  one.
- Only some colours changed — that is normal. The site sends only the swatches
  the customer edited; check the job's log lines, which name each swatch it set.

### A render hangs for two minutes, then every job fails instantly

InDesign had a modal alert open. Nothing can script an application with a
dialog up, so the first job waits out AppleScript's 120-second timeout and every
job after it fails with *"a modal dialog or alert is active"*.

Job mode now runs with `NEVER_INTERACT`, so the script itself never raises one.
If you see this anyway, something else put a dialog on screen: bring InDesign to
the front, dismiss it, and restart the worker.

### "The template uses N font(s) that are not installed on the render Mac"

The render stops rather than setting your directory in a substitute face. The
message names every missing font. Activate them (Minion Pro and Myriad Pro are
Adobe Originals, available through Adobe Fonts with Creative Cloud), or remove
them from any paragraph and character styles that reference them, then re-save
both the `.indd` and the `.idml`.

Note that a font counts as used if *any* style references it, even a style no
text is set in — which is how a template can look right on screen and still
fail this check.

### Missing fonts

- Resolve InDesign's missing-font warning before trusting line endings or overset results.
- Install or activate the template fonts through Adobe Fonts or the licensed font source.
- Reopen the template after activation and rerun the merge. A substituted font can change wrapping and pagination.

### Missing PDF presets

- Open InDesign's Adobe PDF Presets controls and confirm `[High Quality Print]` is installed.
- If it is absent, the success dialog and log identify the fallback preset used.
- Review that fallback's bleed, marks, compression, color conversion, and font embedding before treating the PDF as production-ready.
- Install or define the required preset and rerun when a printer has supplied specific PDF requirements.

## Adobe documentation used

- [Automate workflows with scripts](https://helpx.adobe.com/indesign/desktop/automation-and-scripting/document-automation/automate-workflows-with-scripts.html)
- [Merge records](https://helpx.adobe.com/indesign/desktop/automation-and-scripting/merge-data/merge-records.html)
- [DataMerge DOM reference](https://developer.adobe.com/indesign/uxp/dom/api/d/data-merge/)
- [DataMergePreference DOM reference](https://developer.adobe.com/indesign/uxp/dom/api/d/data-merge-preference/)
- [ExtendScript to UXP migration guide](https://developer.adobe.com/indesign/uxp/resources/migration-guides/extendscript/)

Adobe's current developer reference documents the InDesign DOM under UXP, while this requested `.jsx` uses the older ExtendScript host. Adobe states that ExtendScript uses ES3. The script therefore avoids `let`, `const`, arrow functions, classes, template literals, promises, and modern array methods. The DOM calls and exact 2026 behavior still require one manual run in the installed desktop application.
