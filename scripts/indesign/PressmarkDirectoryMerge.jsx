#target "indesign"

/*
 * Pressmark Directory Merge
 * ExtendScript/ES3-compatible local Data Merge automation for InDesign.
 */

(function () {
    var SCRIPT_NAME = "Pressmark Directory Merge";
    var OUTPUT_NAME = "church-directory-classic-proof.pdf";

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
     * ── Format ──
     *
     * Plain key=value lines, not JSON: ExtendScript's ES3 host has no JSON
     * object, and shipping a JSON parser to read six keys would be its own
     * source of bugs.
     */
    var JOB_HANDOFF_PATH = Folder.userData.fsName +
        "/Pressmark/current-render-job.txt";
    var STALE_JOB_MINUTES = 30;
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

        step = "opening a protected copy of the template";
        templateDocument = app.open(templateFile, true);
        log("Opened template without saving changes to the source file.");

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
    }
}());
