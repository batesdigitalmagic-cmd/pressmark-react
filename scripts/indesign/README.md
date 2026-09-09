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
