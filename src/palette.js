/*
 * The site's accent and its buttons, defined once.
 *
 * Four stylesheets used to carry their own copy of the brand gold — the tool's
 * tokens, the blog theme, the storefront theme and the consent banner — plus a
 * fifth set of literals in Buy.css. They drifted (#96693a here, #8e6738 there).
 * Everything now reads from this file, except Buy.css, which is plain CSS and
 * spells the same values out with a pointer back here.
 */

/*
 * ── The accent: InDesign maroon ──
 *
 * The deep maroon of the InDesign application icon, which is also the dark end
 * of the arrow gradient in the Pressmark mark. It replaces the old gold.
 *
 * `onDark` is not a different brand colour, it is the other half of the same
 * pair. Maroon on the site's navy (#020814) has a contrast ratio of about 1.3:1
 * — a heading or a link in it would simply not be there. InDesign solves
 * exactly this with its own pink, which is the light end of the Pressmark
 * arrow, so anything accented on a dark ground uses that instead.
 */
export const ACCENT = {
  ink: "#460f21",
  deep: "#2e0915",
  soft: "rgba(70, 15, 33, 0.08)",
  line: "rgba(70, 15, 33, 0.28)",
  onDark: "#ef3b6a",
  lineOnDark: "rgba(239, 59, 106, 0.4)",
};

/*
 * ── Buttons: the Google Search button ──
 *
 * A quiet light-grey key with sentence-case text, a hairline that only appears
 * on hover, and a one-pixel shadow. It reads as a control without shouting,
 * which suits a page whose whole argument is that it is calm.
 *
 * Height is 36px, as Google's is — except on a coarse pointer, where every
 * stylesheet raises it to 44px. Google's own page can afford 36px because
 * nobody searches on a phone by tapping that button; ours are the only way
 * through the tool.
 */
export const BUTTON = {
  background: "#f8f9fa",
  border: "#f8f9fa",
  borderHover: "#dadce0",
  text: "#3c4043",
  textHover: "#202124",
  textDisabled: "#9aa0a6",
  radius: "8px",
  height: "36px",
  touchHeight: "44px",
  paddingX: "16px",
  fontSize: "14px",
  shadowHover: "0 1px 1px rgba(0, 0, 0, 0.1)",
};
