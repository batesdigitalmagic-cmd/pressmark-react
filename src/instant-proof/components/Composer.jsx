/*
 * The composer: every action on this page, in one bar.
 *
 * ── Why one bar ──
 *
 * The tool had four numbered cards, each with its own button, all visible at
 * once — four decisions presented as equals when only one of them is ever the
 * next thing to do. This is the opposite arrangement: the single action that
 * finishes the job sits at the foot of the bar, permanently, and everything
 * else is one press away behind a "+".
 *
 * What is behind the plus is not hidden so much as deferred. Download the
 * template, upload the file, read the instructions — each is needed once, in
 * order, and none of them needs to occupy the screen while the customer is
 * doing something else.
 *
 * ── The file input ──
 *
 * A <label> wrapping a visually-hidden <input type="file">, inside the menu.
 * That is the only way to open a file dialog from a menu item without a click
 * being synthesised in script — browsers refuse a programmatic .click() on a
 * file input that is not part of a real user gesture, and a button that
 * silently does nothing is worse than no button.
 *
 * ── State, not decoration ──
 *
 * The bar reports where the job stands: the chosen design, the accepted file
 * and its record count, and why the button is disabled when it is. None of it
 * is invented — every line comes from the page's own validated state.
 */

import ColorControls from "./ColorControls.jsx";
import Popover from "./Popover.jsx";
import { BRAND_COLORS } from "../colors.js";
import { ArrowIcon, ColorMark, DownloadIcon, HelpIcon, PlusIcon, SparkIcon, UploadIcon } from "./Icons.jsx";

export default function Composer({
  design,
  swatchKeys,
  colors,
  defaults,
  onColorsChange,
  onFile,
  onInstructions,
  file,
  accepted,
  checking,
  permitted,
  onPermittedChange,
  blocking,
  onSubmit,
  sample = false,
  onSample,
}) {
  return (
    <div className="ip-composer">
      <div className="ip-composer-state" aria-live="polite">
        {checking ? (
          <span className="ip-composer-file">Checking your CSV…</span>
        ) : accepted && sample ? (
          <span className="ip-composer-file">
            <strong>Sample directory</strong> — {accepted.recordCount} households. Choose your
            colours, then create the PDF.
          </span>
        ) : accepted ? (
          <span className="ip-composer-file">
            <strong>{file?.name}</strong> — {accepted.recordCount} record
            {accepted.recordCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="ip-composer-file ip-muted">No file yet</span>
        )}
      </div>

      <div className="ip-composer-row">
        <Popover label="Add" title="Template and file" className="ip-icon-btn">
          {{
            trigger: <PlusIcon />,
            panel: ({ close }) => (
              <div className="ip-menu">
                <a
                  className="ip-menu-item"
                  href={design.templateCsv}
                  download={design.templateFilename}
                  onClick={close}
                >
                  <DownloadIcon />
                  Download the template
                </a>

                <label className="ip-menu-item">
                  <UploadIcon />
                  Upload your .csv
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="ip-sr-only"
                    onChange={(event) => {
                      onFile(event.target.files?.[0] ?? null);
                      /* Reset so re-choosing the same file fires change again. */
                      event.target.value = "";
                      close();
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="ip-menu-item"
                  onClick={() => {
                    onSample();
                    close();
                  }}
                >
                  <SparkIcon />
                  Try it with sample data
                </button>

                <button
                  type="button"
                  className="ip-menu-item"
                  onClick={() => {
                    onInstructions();
                    close();
                  }}
                >
                  <HelpIcon />
                  Template instructions
                </button>
              </div>
            ),
          }}
        </Popover>

        <Popover
          /* Named individually, because a screen-reader user cannot see the
             mark and "Colours" alone says nothing about what they are set to. */
          label={`Colours: ${BRAND_COLORS.filter((c) => swatchKeys.includes(c.key))
            .map((c) => `${c.label} ${colors[c.key]}`)
            .join(", ")}`}
          title="Colours"
          className="ip-icon-btn"
        >
          {{
            trigger: <ColorMark swatches={swatchKeys.map((key) => colors[key])} />,
            panel: (
              <ColorControls
                colors={colors}
                defaults={defaults}
                design={design}
                keys={swatchKeys}
                onChange={onColorsChange}
              />
            ),
          }}
        </Popover>

        <span className="ip-composer-design" title={design.name}>
          {design.name}
        </span>
      </div>

      {/* The sample is our own made-up directory, so there is nobody's
          permission to confirm. */}
      {!sample && (
        <label className="ip-consent">
          <input
            type="checkbox"
            checked={permitted}
            onChange={(event) => onPermittedChange(event.target.checked)}
          />
          <span>
            I have permission to use this directory information and authorize Pressmark Studio to
            create this PDF.
          </span>
        </label>
      )}

      {blocking && (
        <p className="ip-actions-why" id="create-why">
          {blocking}
        </p>
      )}

      {/*
        * Last, on its own line, at the regular size every button on the site
        * shares. It reads in the order the customer acts: what they have, what
        * they can change, what they are agreeing to, then the one thing that
        * finishes it.
        */}
      <button
        type="button"
        className="ip-btn ip-composer-go"
        disabled={Boolean(blocking)}
        aria-describedby={blocking ? "create-why" : undefined}
        onClick={onSubmit}
      >
        <span>Create My PDF</span>
        <ArrowIcon />
      </button>
    </div>
  );
}
