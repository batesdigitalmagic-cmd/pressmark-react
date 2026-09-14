/*
 * The glyphs this interface uses.
 *
 * Inline SVG rather than an icon font or a package: five shapes do not justify
 * a dependency, and inlining means they inherit currentColor and cannot arrive
 * late or fail to load. Each is stroked on a 24-unit grid at 1.6, so they sit
 * at the same visual weight as the type beside them.
 *
 * Every one is aria-hidden. An icon here is never the only label — the control
 * that carries it always has real text or an aria-label — so announcing it
 * again would just repeat the button.
 */

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const DownloadIcon = () => (
  <svg {...base}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const UploadIcon = () => (
  <svg {...base}>
    <path d="M12 21V9m0 0 4 4m-4-4-4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2" />
  </svg>
);

export const HelpIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.4" />
    <path d="M12 17h.01" />
  </svg>
);

export const SparkIcon = () => (
  <svg {...base}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
  </svg>
);

export const ChatIcon = () => (
  <svg {...base}>
    <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ArrowIcon = () => (
  <svg {...base}>
    <path d="M5 12h13m0 0-5-5m5 5-5 5" />
  </svg>
);

/**
 * The design's palette, as one mark.
 *
 * At most three discs: at 20px a fourth would be four pixels wide and the row
 * would read as a smudge. A design using three shows three; one using six shows
 * its first three. Decorative — the panel this opens reads out every value.
 */
export const ColorMark = ({ swatches = [] }) => {
  const shown = swatches.slice(0, 3);
  /* Centred whatever the count, so one disc does not sit off to the left. */
  const start = 12 - ((shown.length - 1) * 4) / 2;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {shown.map((hex, index) => (
        <circle
          key={hex + index}
          cx={start + index * 4}
          cy="12"
          r="5.6"
          fill={hex}
          stroke={index === 0 ? undefined : "var(--proof-surface)"}
          strokeWidth={index === 0 ? undefined : 1.2}
        />
      ))}
    </svg>
  );
};
