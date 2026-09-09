/*
 * The production PDF offer, shown beneath a finished directory proof.
 *
 * ── Why this is a disclosure and not the proof itself ──
 *
 * The free proof is the thing on screen above this: composed in the browser,
 * instant, and dependent on nothing. Producing a real InDesign PDF needs a Mac
 * running InDesign that has claimed the job from our queue, plus durable object
 * storage the queue can write to. Neither is guaranteed to be up, and in
 * production `getRenderJobStorage()` currently fails closed with a 503.
 *
 * So the PDF is offered, never promised, and asking for it is an explicit act.
 * A visitor who never opens this still got their proof; one who opens it and
 * finds the service down has lost nothing, and is told plainly what happened
 * rather than watching a spinner that will not finish.
 *
 * ── What is sent ──
 *
 * Not the customer's original file. `toDirectoryCsvFile` projects the mapped
 * records down to the eight columns the worker accepts (see csv/directoryExport.js),
 * so the upload carries exactly the names and contact details needed to set the
 * pages and nothing else — no bios, no photo filenames, no record ids.
 */

import { useMemo, useState } from "react";
import DirectoryRenderJob from "./DirectoryRenderJob.jsx";
import { toDirectoryCsvFile, unexportableRecords } from "../csv/directoryExport.js";

export default function DirectoryPdfOffer({
  records,
  schema,
  templateId,
  originalName,
  renderJobId,
  onJobId,
}) {
  /* Opened by the visitor. Nothing is built and nothing is posted until then. */
  const [requested, setRequested] = useState(Boolean(renderJobId));

  /*
   * Built once per record set, not per render.
   *
   * DirectoryRenderJob keys its in-flight submission on the File's identity, so
   * a File rebuilt on every render would post the same directory over and over.
   */
  const built = useMemo(() => {
    if (!requested || records.length === 0) return null;
    return toDirectoryCsvFile(records, schema, originalName);
  }, [requested, records, schema, originalName]);

  const skipped = useMemo(
    () => (requested ? unexportableRecords(records, schema) : []),
    [requested, records, schema]
  );

  if (records.length === 0) return null;

  return (
    <section
      className="ip-section"
      style={{
        border: "1px solid var(--proof-line)",
        borderRadius: "var(--proof-radius)",
        background: "var(--proof-surface)",
        padding: "var(--proof-space-4)",
      }}
    >
      <p className="ip-label">Production PDF</p>

      {!requested ? (
        <>
          <p className="ip-note">
            The proof above was composed in your browser. If you would like the same directory
            typeset through our InDesign production pipeline, we can queue it now — your{" "}
            {records.length} record{records.length === 1 ? "" : "s"} are sent as names and contact
            details only.
          </p>
          <button
            type="button"
            className="ip-btn ip-btn-ghost ip-touch"
            style={{ marginTop: "var(--proof-space-3)" }}
            onClick={() => setRequested(true)}
          >
            Request the production PDF
          </button>
        </>
      ) : (
        <>
          {skipped.length > 0 && (
            <p className="ip-note ip-muted">
              {skipped.length} record{skipped.length === 1 ? "" : "s"} could not be included:{" "}
              {skipped.length === 1 ? "it has" : "they have"} no usable name. Everything else was
              sent.
            </p>
          )}
          <DirectoryRenderJob
            csv={built?.file}
            templateId={templateId}
            initialJobId={renderJobId}
            onJobId={onJobId}
          />
        </>
      )}
    </section>
  );
}
