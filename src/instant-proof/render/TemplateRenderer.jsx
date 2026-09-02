/*
 * Renders a design-template page manifest into DOM.
 *
 * ── Coordinates ──
 *
 * One system, defined in geometry.js: every element is positioned in inches
 * within the box that contains it, and every component here takes that box as a
 * single `box` prop. Page-level elements get the page box; elements inside a
 * repeater cell get the cell box. Type size scales against the same box, so a
 * box is always opened with `containerStyle()`, which establishes the
 * container-query context `pt()` depends on.
 *
 * ── How scaling works ──
 *
 * Positions are percentages of the box and type sizes are `cqw`, so a page
 * holds its internal proportions at any rendered width — 320px on a phone or
 * 972px on a desktop. Nothing measures the DOM, so there is no resize observer
 * and no layout thrash.
 *
 * ── Phase 3 ──
 *
 * A server renderer consumes the same manifest and the same resolveBinding() to
 * emit an InDesign document. This component is the browser half of that pair.
 */

import { useState } from "react";

import { resolveBinding } from "./bindings.js";
import { estimateLines, fitTypeSize, imageFitStyle, textFitStyle } from "./fitting.js";
import { cellBox, containerStyle, frame, inchesAcross, pageBox, pt } from "./geometry.js";

/* Color roles that produce a dark page. The footer credit flips to light type
   on these — a cover is usually one of them, an interior usually is not. */
const DARK_ROLES = new Set(["primary", "ink"]);

/** Resolve a color role against the customer's brand colors. */
function colorOf(role, colors, fallback = "transparent") {
  if (!role) return fallback;
  return colors[role] ?? fallback;
}

function ElementText({ element, content, template, colors, box }) {
  const role = template.fontRoles[element.fontRole] ?? {};
  const lineHeight = role.lineHeight ?? 1.3;
  const maxLines = element.maxLines ?? 1;

  /* 'shrink' steps the size down when the real content is longer than the
     design assumed, then clamps with an ellipsis. Long names are the normal
     case, not the exception. */
  const sizePt =
    element.textFit === "shrink"
      ? fitTypeSize(content, element.width, element.height, role.size ?? 10, maxLines, lineHeight)
      : role.size ?? 10;

  return (
    <div
      style={{
        ...frame(element, box),
        fontFamily: role.family,
        fontWeight: role.weight,
        fontStyle: role.style,
        fontSize: pt(sizePt, box),
        lineHeight,
        letterSpacing: role.letterSpacing,
        textTransform: role.transform,
        textAlign: element.alignment ?? "left",
        color: colorOf(element.color, colors, "inherit"),
        opacity: element.opacity ?? 1,
        /* Newlines in a composite binding (an address block) are meaningful. */
        whiteSpace: element.textFit === "truncate" ? "nowrap" : "pre-line",
        ...textFitStyle(element.textFit ?? "clamp", maxLines),
      }}
    >
      {content}
    </div>
  );
}

/*
 * The placeholder drawn in an empty image frame.
 *
 * Driven by the element's declared `placeholder`, because a frame's shape does
 * not tell you what belongs in it. A portrait slot gets a person; a photo slot
 * gets a landscape mark. A frame that declares nothing — the cover's logo —
 * gets an empty tint, not a person silhouette, which is what it used to get and
 * which reads to a customer as a broken or missing image.
 */
function FramePlaceholder({ kind, colors }) {
  const stroke = colorOf("secondary", colors, "#999");
  if (kind === "portrait") {
    return (
      <svg viewBox="0 0 24 24" width="34%" height="34%" fill="none" stroke={stroke} strokeWidth="1.1" opacity="0.4">
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.5 20c1.4-4 4.2-6 7.5-6s6.1 2 7.5 6" />
      </svg>
    );
  }
  if (kind === "photo") {
    return (
      <svg viewBox="0 0 24 24" width="30%" height="30%" fill="none" stroke={stroke} strokeWidth="1.1" opacity="0.4">
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <path d="M3 16l5-4 4 3 3-2 6 4" />
        <circle cx="8.5" cy="9.5" r="1.4" />
      </svg>
    );
  }
  /* No declared kind: leave the frame empty rather than inventing a glyph. */
  return null;
}

function ElementImage({ element, src, colors, box }) {
  /*
   * A decorative image must never be able to paint a broken-image icon. Chrome
   * collapses a failed `alt=""` image, but Safari and Firefox still draw the
   * glyph at the frame's top-left — which is exactly how a stray broken icon
   * appears in the corner of a spread when artwork fails to load for any
   * reason: a stale cache, a dev server started before the file existed, a
   * clone without the asset. Falling back to the frame placeholder makes the
   * page degrade quietly instead.
   */
  const [failed, setFailed] = useState(false);
  const usable = src && !failed;

  const frameStyle = {
    ...frame(element, box),
    borderRadius: element.radius ? inchesAcross(element.radius, box) : undefined,
    overflow: "hidden",
    background: colorOf(element.background, colors, "rgba(2,8,20,0.06)"),
  };

  if (!usable) {
    return (
      <div
        style={{ ...frameStyle, display: "flex", alignItems: "center", justifyContent: "center" }}
        aria-hidden="true"
      >
        <FramePlaceholder kind={element.placeholder} colors={colors} />
      </div>
    );
  }

  return (
    <div style={frameStyle}>
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", display: "block", ...imageFitStyle(element.fitMode) }}
      />
    </div>
  );
}

function ElementBlock({ element, colors, box }) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...frame(element, box),
        background: colorOf(element.background, colors, "transparent"),
        opacity: element.opacity ?? 1,
      }}
    />
  );
}

/*
 * A vertical flow region.
 *
 * Everything else in a template is absolutely positioned, which is right for a
 * designed page: a portrait grid needs its cards on a grid whatever the data
 * says. But a biography followed by contact details is genuinely sequential —
 * the contact block belongs directly under whatever the biography turned out to
 * be, and a member with no phone number should not leave a phone-sized hole.
 *
 * A `stack` lays its children out in order from its own top edge:
 *
 *   • A child whose binding resolves to nothing is skipped entirely, and its
 *     height and its gap are both reclaimed — the rest flows up.
 *   • A visible child takes only the height its content actually needs, up to
 *     its own maxLines.
 *   • A child may name a `group`; crossing a group boundary uses `groupGap`
 *     instead of `gap`, so the contact block keeps its separation from the
 *     biography even when the first contact line is the one that is missing.
 *   • If the children together exceed the region, the child marked `flexible`
 *     gives up lines until they fit. Nothing is ever laid out past the bottom
 *     of the region.
 *
 * The region has a fixed height, so the whitespace a short record leaves falls
 * at the FOOT of the page where it reads as margin, rather than in the middle
 * where it reads as a mistake.
 */
function ElementStack({ element, record, context, template, colors, box }) {
  const gap = element.gap ?? 0.1;
  const groupGap = element.groupGap ?? gap;

  /* Resolve first: only children with content take part in the layout. */
  const visible = [];
  for (const child of element.children ?? []) {
    const value = resolveBinding(child.field, { ...context, record }).value;
    if (!value) continue;
    const role = template.fontRoles[child.fontRole] ?? {};
    const lineHeight = role.lineHeight ?? 1.3;
    const maxLines = child.maxLines ?? 1;
    const needed = Math.min(estimateLines(value, element.width, role.size ?? 10), maxLines);
    visible.push({ child, value, role, lineHeight, maxLines, lines: Math.max(needed, 1) });
  }

  const heightOf = (entry) => (entry.lines * (entry.role.size ?? 10) * entry.lineHeight) / 72;
  const gapBefore = (entry, index) =>
    index === 0 ? 0 : entry.child.group === visible[index - 1].child.group ? gap : groupGap;

  const total = () =>
    visible.reduce((sum, entry, index) => sum + heightOf(entry) + gapBefore(entry, index), 0);

  /* Trim the flexible child rather than letting the stack run past its region. */
  const flexible = visible.find((entry) => entry.child.flexible);
  while (flexible && flexible.lines > 1 && total() > element.height) {
    flexible.lines -= 1;
  }

  let cursor = 0;
  return (
    <div style={frame(element, box)}>
      {visible.map((entry, index) => {
        const height = heightOf(entry);
        cursor += gapBefore(entry, index);
        const top = cursor;
        cursor += height;

        /* Children are positioned against the stack, so their percentages use
           the stack's own dimensions — the same box rule as everywhere else. */
        const style = {
          position: "absolute",
          left: 0,
          top: `${(top / element.height) * 100}%`,
          width: "100%",
          height: `${(height / element.height) * 100}%`,
        };

        return (
          <div
            key={index}
            style={{
              ...style,
              fontFamily: entry.role.family,
              fontWeight: entry.role.weight,
              fontStyle: entry.role.style,
              fontSize: pt(entry.role.size ?? 10, box),
              lineHeight: entry.lineHeight,
              letterSpacing: entry.role.letterSpacing,
              textTransform: entry.role.transform,
              color: colorOf(entry.child.color, colors, "inherit"),
              opacity: entry.child.opacity ?? 1,
              whiteSpace: "pre-line",
              ...textFitStyle("clamp", entry.lines),
            }}
          >
            {entry.value}
          </div>
        );
      })}
    </div>
  );
}

/*
 * One repeated record cell.
 *
 * The cell is its own coordinate box AND its own container-query context, so
 * an element declared at `x: 0, y: 2.6` sits 2.6in down from the top of THIS
 * cell and a 16pt name renders at 16pt relative to it.
 *
 * Cells never render placeholder text. A grid slot with no record shows the
 * styled portrait frame — which is what production does for a missing
 * photograph — and nothing else. Emitting the manifest's placeholder here is
 * how "Name" ended up printed across empty slots.
 */
function RepeaterCell({ cellElements, record, context, template, colors, box }) {
  return (
    <div style={containerStyle()}>
      {cellElements.map((element, index) => {
        const binding = resolveBinding(element.field, { ...context, record });

        if (element.type === "image") {
          return <ElementImage key={index} element={element} src={binding.value} colors={colors} box={box} />;
        }
        if (element.type === "rule" || element.type === "block") {
          return <ElementBlock key={index} element={element} colors={colors} box={box} />;
        }

        /* An empty field collapses rather than leaving a gap or a placeholder.
           Its reserved space stays reserved, so neighbouring cards still line
           up row to row. */
        if (!binding.value) return null;

        return (
          <ElementText
            key={index}
            element={element}
            content={binding.value}
            template={template}
            colors={colors}
            box={box}
          />
        );
      })}
    </div>
  );
}

function ElementRepeater({ element, records, context, template, colors, box }) {
  const { columns = 1, rows = 1, gapX = 0, gapY = 0 } = element.repeat ?? {};
  const start = element.startIndex ?? 0;
  const cell = cellBox(element);

  return (
    <div
      style={{
        ...frame(element, box),
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        columnGap: `${(gapX / element.width) * 100}%`,
        rowGap: `${(gapY / element.height) * 100}%`,
      }}
    >
      {Array.from({ length: columns * rows }, (_, index) => (
        <RepeaterCell
          key={index}
          cellElements={element.cell ?? []}
          record={records[start + index] ?? null}
          context={context}
          template={template}
          colors={colors}
          box={cell}
        />
      ))}
    </div>
  );
}

/*
 * The Pressmark credit in the page footer.
 *
 * Replaces the diagonal watermark that used to cover each page. It sits in the
 * footer margin, clear of the folios (which the templates place at the outer
 * edges), so it reads as a colophon rather than as damage to the design.
 *
 * On a spread it is centred within the RIGHT-HAND page rather than across the
 * whole sheet. Centring on a spread would put it over the gutter, where several
 * templates run a dark panel or a full-bleed photograph up the left page — half
 * the credit would land on dark artwork and disappear. The right page's footer
 * margin is clear in every shipped template, and a colophon on the recto is
 * conventional anyway.
 *
 * Note what this no longer does: a watermark across the artwork made it
 * impractical to pass the sample off as a finished piece. A footer credit does
 * not. If that protection is wanted back, the honest place for it is the
 * footer text itself rather than an overlay.
 */
function FooterMark({ mark, onDark, spread }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: spread ? "50%" : 0,
        right: 0,
        bottom: "2.6%",
        textAlign: "center",
        pointerEvents: "none",
        userSelect: "none",
        fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
        fontSize: "0.85cqw",
        fontWeight: 700,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: onDark ? "#ffffff" : "#0f1c2e",
        opacity: mark.opacity ?? (onDark ? 0.5 : 0.42),
        zIndex: 5,
      }}
    >
      {mark.text}
    </div>
  );
}

/**
 * Render one template page.
 *
 * @param {object} props
 * @param {import('../templates/registry.js').DesignTemplate} props.template
 * @param {import('../templates/registry.js').TemplatePage} props.page
 * @param {Record<string,string>[]} props.records
 * @param {object} props.context   Passed to resolveBinding.
 * @param {Record<string,string>} props.colors  Resolved color roles.
 */
export default function TemplateRenderer({ template, page, records, context, colors }) {
  const box = pageBox(template, page);

  return (
    <div
      style={{
        ...containerStyle(),
        height: undefined,
        aspectRatio: `${box.widthIn} / ${box.heightIn}`,
        background: colorOf(page.backgroundColor, colors, "#ffffff"),
        overflow: "hidden",
      }}
    >
      {page.background && (
        <img
          src={page.background}
          alt=""
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill" }}
        />
      )}

      {(page.elements ?? []).map((element, index) => {
        if (element.type === "repeater") {
          return (
            <ElementRepeater
              key={index}
              element={element}
              records={records}
              context={context}
              template={template}
              colors={colors}
              box={box}
            />
          );
        }

        if (element.type === "rule" || element.type === "block") {
          return <ElementBlock key={index} element={element} colors={colors} box={box} />;
        }

        /* A page-level element may pin itself to one record (a featured
           profile) rather than repeating. */
        const record = element.recordIndex !== undefined ? records[element.recordIndex] ?? null : null;

        if (element.type === "stack") {
          return (
            <ElementStack
              key={index}
              element={element}
              record={record}
              context={context}
              template={template}
              colors={colors}
              box={box}
            />
          );
        }

        const binding = resolveBinding(element.field, { ...context, record });

        if (element.type === "image") {
          return <ElementImage key={index} element={element} src={binding.value} colors={colors} box={box} />;
        }

        /* Placeholders are a page-level affordance only — they stand in for the
           organization name on a cover before it is typed. Repeater cells never
           use them; see RepeaterCell. */
        const content = binding.value || element.placeholder || "";
        if (!content) return null;

        return (
          <ElementText
            key={index}
            element={element}
            content={content}
            template={template}
            colors={colors}
            box={box}
          />
        );
      })}

      {template.footerMark && (
        <FooterMark
          mark={template.footerMark}
          spread={page.form === "spread"}
          /* A page may state its own footer contrast when the artwork behind
             the credit disagrees with the page's base color. */
          onDark={page.footerOnDark ?? DARK_ROLES.has(page.backgroundColor)}
        />
      )}
    </div>
  );
}
