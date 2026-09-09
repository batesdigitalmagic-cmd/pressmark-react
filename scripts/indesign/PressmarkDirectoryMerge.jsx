#target "indesign"

/*
 * Pressmark Directory Merge
 * ExtendScript/ES3-compatible local Data Merge automation for InDesign.
 */

(function () {
    var SCRIPT_NAME = "Pressmark Directory Merge";
    var OUTPUT_NAME = "church-directory-classic-proof.pdf";
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

    try {
        step = "selecting the InDesign template";
        var templateFile = chooseFile("Select church-directory-classic.indd", "Adobe InDesign document:*.indd");
        if (extensionOf(templateFile) !== "indd") {
            fail("Select an .indd template. The .idml file is a portable backup, not the production source.");
        }
        if (documentIsOpen(templateFile)) {
            fail("The selected template is already open. Close it first so this script cannot discard unsaved work.");
        }

        step = "selecting the CSV data source";
        var csvFile = chooseFile("Select church-directory-classic.csv", "CSV data source:*.csv");
        if (extensionOf(csvFile) !== "csv") {
            fail("Select a .csv data source.");
        }

        step = "selecting the output folder";
        var outputFolder = Folder.selectDialog("Select the folder for the merged PDF and log");
        if (outputFolder === null) {
            fail("Selection cancelled.");
        }
        logFile = File(outputFolder.fsName + "/PressmarkDirectoryMerge.log");
        log("Started.");
        log("Template: " + templateFile.fsName);
        log("CSV: " + csvFile.fsName);

        step = "validating CSV headers";
        var headers = readHeaders(csvFile);
        var missing = missingHeaders(headers);
        if (missing.length > 0) {
            fail("The CSV is missing required header(s):\n\n" + missing.join("\n"));
        }
        log("CSV headers validated: " + REQUIRED_HEADERS.join(", "));

        step = "preparing the output PDF";
        var pdfFile = File(outputFolder.fsName + "/" + OUTPUT_NAME);
        if (pdfFile.exists) {
            if (!confirm("The output PDF already exists:\n\n" + pdfFile.fsName + "\n\nReplace it?")) {
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
        log("Success. The merged document remains open for inspection.");

        alert(
            SCRIPT_NAME + " completed successfully.\n\n" +
            presetResult.message + "\n\n" +
            "PDF:\n" + pdfFile.fsName + "\n\n" +
            "The merged InDesign document remains open for inspection."
        );
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
        alert(SCRIPT_NAME + "\n\n" + errorMessage);
    }
}());
