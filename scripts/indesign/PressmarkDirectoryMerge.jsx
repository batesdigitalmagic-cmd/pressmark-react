#target "indesign"

/*
 * Pressmark Directory Merge
 * ExtendScript/ES3-compatible local Data Merge automation for InDesign.
 */

(function () {
    var SCRIPT_NAME = "Pressmark Directory Merge";
    var OUTPUT_NAME = "directory-classic-proof.pdf";

    /*
     * ── Two modes, one layout engine ──
     *
     * MANUAL (unchanged): double-clicked from the Scripts panel. Asks for the
     * template, the CSV and an output folder, and reports with alerts.
     *
     * JOB: the Pressmark Mac worker has left a handoff file. Every path is
     * given, no dialog is shown, and the outcome is written to a result file
     * the worker polls for.
     *
     * ── Why a handoff FILE and not script arguments ──
     *
     * This whole script is wrapped in an IIFE, so the global `arguments` array
     * that InDesign's `do script ... with arguments` populates is shadowed by
     * this function's own `arguments` object. Reading it here would silently
     * get the wrong thing. A file at a fixed path has no such ambiguity, needs
     * no AppleScript plumbing, and is trivially inspectable when a render goes
     * wrong.
     *
     * The file is CONSUMED — deleted as soon as it is read — so a later manual
     * double-click can never be captured by a stale job. A file older than
     * STALE_JOB_MINUTES is ignored for the same reason.
     *
     * ── Brand colours ──
     *
     * Any number of `swatch.<Name>` keys may be present, each carrying four whole
     * percentages, "c,m,y,k", already converted by the worker — the arithmetic
     * belongs where it can be unit-tested, not in ES3. Each recolours the named
     * swatch on the per-job COPY of the template the worker hands over.
     *
     *     swatch.PM_Primary=100,90,10,0
     *
     * The swatch is named in the key rather than mapped from a list kept here,
     * so a colour added to the site needs no change to this script. The names
     * come from the site's own allow-list, never from anything a customer typed.
     *
     * When no swatch key is present the document is not touched at all and the
     * template renders in its own colours — which is the normal case, because the
     * site only sends the swatches a customer actually changed.
     *
     * ── Format ──
     *
     * Plain key=value lines, not JSON: ExtendScript's ES3 host has no JSON
     * object, and shipping a JSON parser to read six keys would be its own
     * source of bugs.
     */
    var JOB_HANDOFF_PATH = Folder.userData.fsName +
        "/Pressmark/current-render-job.txt";
    var STALE_JOB_MINUTES = 30;
    /* Handoff keys that name a swatch to recolour. Every swatch must already
       exist in the template as a CMYK process colour; this script recolours
       them, it never creates them. */
    var SWATCH_PREFIX = "swatch.";
    /* InDesign's own swatches. Named here so the guard below reads as the rule
       it enforces rather than as an accident of which names we happen to use. */
    var PROTECTED_SWATCHES = ["[Paper]", "[Black]", "[Registration]", "[None]"];
    var REQUIRED_HEADERS = [
        "last_name",
        "first_name",
        "address",
        "phone",
        "alternate_phone",
        "email",
        "alternate_email",
        "family_members"
    ];

    var step = "starting";
    var logFile = null;
    var templateDocument = null;
    var mergedDocument = null;

    function timestamp() {
        var now = new Date();
        return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
            " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    }

    function pad(value) {
        return value < 10 ? "0" + value : String(value);
    }

    function log(message) {
        if (logFile === null) {
            return;
        }
        logFile.encoding = "UTF-8";
        if (logFile.open("a")) {
            logFile.lineFeed = "Unix";
            logFile.writeln("[" + timestamp() + "] " + message);
            logFile.close();
        }
    }

    function fail(message) {
        throw new Error(message);
    }

    function chooseFile(promptText, filterText) {
        var selected = File.openDialog(promptText, filterText, false);
        if (selected === null) {
            fail("Selection cancelled.");
        }
        return selected;
    }

    function extensionOf(file) {
        var match = file.name.match(/\.([^.]+)$/);
        return match === null ? "" : match[1].toLowerCase();
    }

    function parseFirstCsvRecord(text) {
        var fields = [];
        var field = "";
        var quoted = false;
        var index;
        var character;

        for (index = 0; index < text.length; index += 1) {
            character = text.charAt(index);
            if (quoted) {
                if (character === '"') {
                    if (index + 1 < text.length && text.charAt(index + 1) === '"') {
                        field += '"';
                        index += 1;
                    } else {
                        quoted = false;
                    }
                } else {
                    field += character;
                }
            } else if (character === '"' && field.length === 0) {
                quoted = true;
            } else if (character === ",") {
                fields.push(field);
                field = "";
            } else if (character === "\r" || character === "\n") {
                fields.push(field);
                return fields;
            } else {
                field += character;
            }
        }

        fields.push(field);
        return fields;
    }

    function trim(value) {
        return value.replace(/^\s+|\s+$/g, "");
    }

    function readHeaders(csvFile) {
        var contents;
        var headers;
        var index;

        csvFile.encoding = "UTF-8";
        if (!csvFile.open("r")) {
            fail("Could not open the CSV for reading: " + csvFile.fsName);
        }
        contents = csvFile.read();
        csvFile.close();

        if (contents.length === 0) {
            fail("The selected CSV is empty.");
        }

        headers = parseFirstCsvRecord(contents);
        if (headers.length > 0 && headers[0].length > 0 && headers[0].charCodeAt(0) === 65279) {
            headers[0] = headers[0].substring(1);
        }
        for (index = 0; index < headers.length; index += 1) {
            headers[index] = trim(headers[index]);
        }
        return headers;
    }

    function missingHeaders(headers) {
        var missing = [];
        var requiredIndex;
        var headerIndex;
        var found;

        for (requiredIndex = 0; requiredIndex < REQUIRED_HEADERS.length; requiredIndex += 1) {
            found = false;
            for (headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
                if (headers[headerIndex] === REQUIRED_HEADERS[requiredIndex]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                missing.push(REQUIRED_HEADERS[requiredIndex]);
            }
        }
        return missing;
    }

    function documentIsOpen(file) {
        var index;
        var document;
        for (index = 0; index < app.documents.length; index += 1) {
            document = app.documents.item(index);
            if (document.saved && document.fullName.fsName === file.fsName) {
                return true;
            }
        }
        return false;
    }

    function snapshotDocumentIds() {
        var ids = {};
        var index;
        for (index = 0; index < app.documents.length; index += 1) {
            ids[String(app.documents.item(index).id)] = true;
        }
        return ids;
    }

    function findNewDocument(previousIds) {
        var index;
        var candidate;
        for (index = 0; index < app.documents.length; index += 1) {
            candidate = app.documents.item(index);
            if (!previousIds[String(candidate.id)]) {
                return candidate;
            }
        }
        return null;
    }

    /* ── Job mode plumbing ── */

    /* key=value lines. Values may contain "=", so only the first one splits. */
    function parseHandoff(text) {
        var spec = {};
        var lines = text.split(/\r\n|\r|\n/);
        var index;
        var line;
        var split;
        for (index = 0; index < lines.length; index += 1) {
            line = trim(lines[index]);
            if (line.length === 0 || line.charAt(0) === "#") {
                continue;
            }
            split = line.indexOf("=");
            if (split > 0) {
                spec[trim(line.substring(0, split))] = trim(line.substring(split + 1));
            }
        }
        return spec;
    }

    /*
     * Read and CONSUME the handoff file.
     *
     * Deleting it before doing any work is what guarantees a manual run started
     * later cannot inherit this job, and that a crashed render does not replay
     * itself the next time InDesign opens the script.
     */
    function readJobSpec() {
        var handoff = File(JOB_HANDOFF_PATH);
        var contents;
        var spec;
        var ageMinutes;

        if (!handoff.exists) {
            return null;
        }

        ageMinutes = (new Date().getTime() - handoff.modified.getTime()) / 60000;

        handoff.encoding = "UTF-8";
        if (!handoff.open("r")) {
            return null;
        }
        contents = handoff.read();
        handoff.close();
        handoff.remove();

        if (ageMinutes > STALE_JOB_MINUTES) {
            return null;
        }

        spec = parseHandoff(contents);
        if (!spec.jobId || !spec.template || !spec.csv || !spec.output || !spec.result) {
            return null;
        }
        return spec;
    }

    /*
     * "c,m,y,k" as four whole percentages, or null if it is anything else.
     *
     * The worker validated and converted these, so a value that fails here means
     * the two sides have drifted apart. Returning null makes that a clear failure
     * rather than a render in a colour nobody chose.
     */
    function parseCmyk(text) {
        var parts = String(text).split(",");
        var values = [];
        var index;
        var piece;
        var number;

        if (parts.length !== 4) {
            return null;
        }
        for (index = 0; index < 4; index += 1) {
            piece = trim(parts[index]);
            if (!/^[0-9]{1,3}$/.test(piece)) {
                return null;
            }
            number = parseInt(piece, 10);
            if (number < 0 || number > 100) {
                return null;
            }
            values.push(number);
        }
        return values;
    }

    function isProtectedSwatch(name) {
        var index;
        for (index = 0; index < PROTECTED_SWATCHES.length; index += 1) {
            if (PROTECTED_SWATCHES[index] === name) {
                return true;
            }
        }
        return false;
    }

    /*
     * Recolour one named swatch, or fail saying exactly what is wrong with it.
     *
     * `document.colors` rather than `document.swatches`: the swatches collection
     * also holds gradients, tints and mixed inks, which have no colour space to
     * check and would throw on the comparison below. Looking only at colours
     * means a gradient that happens to carry the name is reported as a missing
     * colour swatch, which is the truth.
     *
     * A wrong space or model is a hard failure rather than something to convert
     * on the fly. An RGB swatch in a document destined for print is a production
     * problem the operator needs to fix in the template, and silently converting
     * it would hide that from the one person who can.
     */
    function applyBrandColor(document, name, values) {
        var swatch;

        /*
         * The name arrives in a handoff key rather than as a constant here, so
         * it is checked before it is used. It comes from the site's own
         * allow-list and never from anything a customer typed, but a swatch
         * name is the one thing in this file that is not fixed, and InDesign's
         * reserved swatches must stay reserved whatever is handed over.
         */
        if (name.length === 0 || name.length > 100) {
            fail("A swatch name in this job was empty or absurdly long.");
        }
        if (isProtectedSwatch(name)) {
            fail("Refusing to modify the reserved swatch " + name + ".");
        }
        swatch = document.colors.itemByName(name);
        if (!swatch.isValid) {
            fail("The template has no colour swatch named \"" + name + "\". Add it as a CMYK process swatch and apply it to the elements it should colour.");
        }
        if (swatch.space !== ColorSpace.CMYK) {
            fail("The swatch \"" + name + "\" is not a CMYK swatch. Custom colours must be CMYK process swatches.");
        }
        if (swatch.model !== ColorModel.PROCESS) {
            fail("The swatch \"" + name + "\" is not a process swatch. Custom colours must be CMYK process swatches.");
        }
        swatch.colorValue = values;
        return values.join("/");
    }

    /*
     * The worker's only channel back. Written for BOTH outcomes and written
     * last, so its existence means this script ran to a conclusion — a missing
     * result file tells the worker InDesign died rather than leaving it to
     * guess from a PDF that may or may not be complete.
     */
    function writeResult(resultPath, status, message, pdfPath) {
        var file = File(resultPath);
        file.encoding = "UTF-8";
        if (!file.open("w")) {
            return;
        }
        file.lineFeed = "Unix";
        file.writeln("status=" + status);
        file.writeln("pdf=" + (pdfPath === undefined || pdfPath === null ? "" : pdfPath));
        /* One line only: newlines would break the key=value contract. */
        file.writeln("message=" + String(message === undefined ? "" : message).replace(/[\r\n]+/g, " "));
        file.close();
    }

    function findPdfPreset() {
        var preferred = app.pdfExportPresets.itemByName("[High Quality Print]");
        var fallback;

        if (preferred.isValid) {
            return { preset: preferred, message: "Using PDF preset [High Quality Print]." };
        }
        if (app.pdfExportPresets.length > 0) {
            fallback = app.pdfExportPresets.item(0);
            return {
                preset: fallback,
                message: "[High Quality Print] is unavailable; using the first installed preset: " + fallback.name + "."
            };
        }
        return {
            preset: null,
            message: "[High Quality Print] is unavailable and no PDF preset is installed; using current PDF export preferences."
        };
    }

    var jobSpec = null;
    /*
     * The operator's own dialog setting, captured so it can be put back.
     *
     * Job mode switches InDesign to NEVER_INTERACT, and that preference belongs
     * to the running application, not to this script: left changed, the
     * operator's next manual session would silently swallow every alert. The
     * finally block below restores it on success, on failure and on a throw.
     */
    var previousInteraction = null;

    try {
        step = "reading the render job handoff";
        jobSpec = readJobSpec();

        var templateFile;
        var csvFile;
        var outputFolder;
        var pdfFile;

        if (jobSpec === null) {
            /* ── Manual mode: unchanged from the original script. ── */
            step = "selecting the InDesign template";
            templateFile = chooseFile("Select church-directory-classic.indd", "Adobe InDesign document:*.indd");
            if (extensionOf(templateFile) !== "indd") {
                fail("Select an .indd template. The .idml file is a portable backup, not the production source.");
            }
            if (documentIsOpen(templateFile)) {
                fail("The selected template is already open. Close it first so this script cannot discard unsaved work.");
            }

            step = "selecting the CSV data source";
            csvFile = chooseFile("Select church-directory-classic.csv", "CSV data source:*.csv");
            if (extensionOf(csvFile) !== "csv") {
                fail("Select a .csv data source.");
            }

            step = "selecting the output folder";
            outputFolder = Folder.selectDialog("Select the folder for the merged PDF and log");
            if (outputFolder === null) {
                fail("Selection cancelled.");
            }
            pdfFile = File(outputFolder.fsName + "/" + OUTPUT_NAME);
        } else {
            /* ── Job mode: every path supplied, nothing asked. ── */
            step = "preparing the render job";
            templateFile = File(jobSpec.template);
            csvFile = File(jobSpec.csv);
            pdfFile = File(jobSpec.output);
            outputFolder = pdfFile.parent;
            if (!templateFile.exists) {
                fail("The configured InDesign template was not found.");
            }
            if (!csvFile.exists) {
                fail("The job CSV was not found.");
            }
            if (documentIsOpen(templateFile)) {
                fail("The production template is open in InDesign. Close it so the worker can use it.");
            }
            if (!outputFolder.exists) {
                outputFolder.create();
            }
        }

        logFile = File(outputFolder.fsName + "/PressmarkDirectoryMerge.log");
        log("Started" + (jobSpec === null ? " (manual)." : " (job " + jobSpec.jobId + ")."));
        /* The template path is ours; the CSV path is a temporary working file.
           Neither is customer content, and no CSV VALUE is ever logged. */
        log("Template: " + templateFile.fsName);

        step = "validating CSV headers";
        var headers = readHeaders(csvFile);
        var missing = missingHeaders(headers);
        if (missing.length > 0) {
            fail("The CSV is missing required header(s):\n\n" + missing.join("\n"));
        }
        log("CSV headers validated: " + REQUIRED_HEADERS.join(", "));

        step = "preparing the output PDF";
        if (pdfFile.exists) {
            /* In job mode the output path is a fresh per-job directory the
               worker just created, so anything there is a leftover from a
               retried attempt and is replaced without asking. Manual mode still
               confirms, because that folder is the operator's own. */
            if (jobSpec === null && !confirm("The output PDF already exists:\n\n" + pdfFile.fsName + "\n\nReplace it?")) {
                fail("Output replacement cancelled.");
            }
            if (!pdfFile.remove()) {
                fail("Could not replace the existing output PDF. Close it if another application is using it.");
            }
            log("Removed existing output PDF.");
        }

        /*
         * ── An unattended render never waits on a dialog ──
         *
         * A missing-fonts or profile-mismatch alert raised by app.open is modal.
         * Nobody is at the Mac to dismiss it, so the script used to sit behind
         * it until AppleScript's 120-second timeout — and the alert stayed up,
         * blocking every job after it as well. NEVER_INTERACT makes InDesign
         * take the default action instead of asking.
         *
         * Manual mode is left alone: an operator at the keyboard wants to see
         * those alerts.
         */
        if (jobSpec !== null) {
            /*
             * Best effort, never fatal.
             *
             * Changing this preference is refused ("Cannot handle the request
             * because a modal dialog or alert is active") whenever a dialog is
             * already open in InDesign — while read-only calls such as
             * app.documents.length still succeed, which makes the state easy to
             * misdiagnose. Failing here is not a reason to stop: the render then
             * behaves exactly as it did before suppression existed, and if the
             * dialog is still up, app.open reports that below with a clearer step.
             */
            try {
                previousInteraction = app.scriptPreferences.userInteractionLevel;
                app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
            } catch (interactionError) {
                previousInteraction = null;
                log("Could not suppress dialogs (" + interactionError.message + "); rendering with the current setting.");
            }
        }

        step = "opening a protected copy of the template";
        templateDocument = app.open(templateFile, true);

        /*
         * ── ...but it never ships substituted fonts either ──
         *
         * Suppressing the dialog does not make the fonts appear; InDesign just
         * substitutes silently. A directory set in a fallback face is a broken
         * deliverable that looks finished, so in job mode a missing font fails
         * the render and names every one, which is what the dialog would have
         * told an operator had one been there.
         */
        if (jobSpec !== null) {
            step = "checking the template's fonts";
            var missingFonts = [];
            var fontIndex;
            var font;
            for (fontIndex = 0; fontIndex < templateDocument.fonts.length; fontIndex += 1) {
                font = templateDocument.fonts.item(fontIndex);
                if (font.status !== FontStatus.INSTALLED) {
                    missingFonts.push(font.name.replace(/\t/g, " "));
                }
            }
            if (missingFonts.length > 0) {
                fail("The template uses " + missingFonts.length + " font(s) that are not installed on the render Mac: " +
                    missingFonts.join(", ") + ". Activate them, or remove them from the template's styles, and re-save.");
            }
            log("All " + templateDocument.fonts.length + " template fonts are installed.");
        }
        log("Opened template without saving changes to the source file.");

        /*
         * ── Brand colours ──
         *
         * Applied to the open document BEFORE the merge, so every generated page
         * inherits them: the merged document is built from this one, and a swatch
         * changed afterwards would only affect a document that no longer matters.
         *
         * In job mode `templateFile` is the worker's per-job copy, so nothing
         * written here can reach the operator's production template. Manual mode
         * never has colours in the first place and is unchanged.
         */
        var appliedCount = 0;
        if (jobSpec !== null) {
            step = "applying your brand colours";
            var swatchName;
            var swatchValues;
            for (var specKey in jobSpec) {
                /* ES3 has no Object.keys and no hasOwnProperty guard worth the
                   lines here — jobSpec is a plain object this script built. */
                if (specKey.indexOf(SWATCH_PREFIX) !== 0) {
                    continue;
                }
                swatchName = specKey.substring(SWATCH_PREFIX.length);
                swatchValues = parseCmyk(jobSpec[specKey]);
                if (swatchValues === null) {
                    fail("The value sent for swatch \"" + swatchName + "\" was not four CMYK percentages.");
                }
                log(swatchName + " set to " + applyBrandColor(templateDocument, swatchName, swatchValues) + " (C/M/Y/K).");
                appliedCount += 1;
            }
        }
        if (appliedCount === 0) {
            log("No brand colours supplied; using the template's own swatches.");
        }

        step = "attaching the Data Merge data source";
        var dataMerge = templateDocument.dataMergeProperties;
        dataMerge.selectDataSource(csvFile);
        dataMerge.dataMergePreferences.recordSelection = RecordSelection.ALL_RECORDS;
        log("Attached data source and selected all records.");
        log("Preserved template records-per-page and multiple-record layout settings.");

        step = "merging all records";
        var previousDocumentIds = snapshotDocumentIds();
        var oversetReport = File(outputFolder.fsName + "/church-directory-classic-overset-report.txt");
        dataMerge.mergeRecords(oversetReport);
        mergedDocument = findNewDocument(previousDocumentIds);
        if (mergedDocument === null || !mergedDocument.isValid) {
            fail("InDesign did not expose a newly generated merged document.");
        }
        log("Created merged document: " + mergedDocument.name);

        step = "closing the unchanged source template";
        templateDocument.close(SaveOptions.NO);
        templateDocument = null;
        log("Closed the source template without saving.");

        step = "selecting PDF export settings";
        var presetResult = findPdfPreset();
        log(presetResult.message);

        step = "exporting the merged PDF";
        if (presetResult.preset === null) {
            mergedDocument.exportFile(ExportFormat.PDF_TYPE, pdfFile, false);
        } else {
            mergedDocument.exportFile(ExportFormat.PDF_TYPE, pdfFile, false, presetResult.preset);
        }
        if (!pdfFile.exists) {
            fail("InDesign completed the export call, but the PDF was not found at the expected path.");
        }
        log("Exported PDF: " + pdfFile.fsName);

        if (jobSpec === null) {
            log("Success. The merged document remains open for inspection.");
            alert(
                SCRIPT_NAME + " completed successfully.\n\n" +
                presetResult.message + "\n\n" +
                "PDF:\n" + pdfFile.fsName + "\n\n" +
                "The merged InDesign document remains open for inspection."
            );
        } else {
            /*
             * Job mode closes the merged document.
             *
             * Manual mode leaves it open on purpose, for inspection. A worker
             * running unattended must not: every job would leave another
             * untitled document behind until InDesign ran out of memory, and
             * the next job's findNewDocument() would have more candidates to
             * pick from.
             */
            step = "closing the merged document";
            try {
                mergedDocument.close(SaveOptions.NO);
                mergedDocument = null;
                log("Closed the merged document.");
            } catch (closeError) {
                log("Could not close the merged document: " + closeError.message);
            }
            writeResult(jobSpec.result, "completed", "Rendered " + OUTPUT_NAME + ".", pdfFile.fsName);
            log("Success. Result written for job " + jobSpec.jobId + ".");
        }
    } catch (error) {
        var lineNumber = error.line === undefined ? "unknown" : error.line;
        var errorMessage = "Failed while " + step + ".\n\n" + error.message + "\n\nScript line: " + lineNumber;
        log("ERROR while " + step + " (line " + lineNumber + "): " + error.message);

        if (templateDocument !== null && templateDocument.isValid) {
            try {
                templateDocument.close(SaveOptions.NO);
                log("Closed the source template without saving after the error.");
            } catch (closeError) {
                log("Could not close the source template after the error: " + closeError.message);
            }
        }
        /*
         * A merged document may exist even on failure (the export threw). Close
         * it in job mode so a retry starts from a clean application state.
         */
        if (jobSpec !== null && mergedDocument !== null && mergedDocument.isValid) {
            try {
                mergedDocument.close(SaveOptions.NO);
                log("Closed the merged document after the error.");
            } catch (mergedCloseError) {
                log("Could not close the merged document after the error: " + mergedCloseError.message);
            }
        }

        if (jobSpec === null) {
            alert(SCRIPT_NAME + "\n\n" + errorMessage);
        } else {
            /*
             * The worker turns this into the customer-facing message, so it
             * carries the step and InDesign's own reason but never a file path:
             * "Failed while merging all records" is useful, the operator's disk
             * layout is not.
             */
            writeResult(jobSpec.result, "failed", "Failed while " + step + ". " + error.message, "");
        }
    } finally {
        /* Whatever happened above, the application goes back to asking. */
        if (previousInteraction !== null) {
            try {
                app.scriptPreferences.userInteractionLevel = previousInteraction;
            } catch (restoreError) {
                log("Could not restore the dialog setting: " + restoreError.message);
            }
        }
    }
}());
