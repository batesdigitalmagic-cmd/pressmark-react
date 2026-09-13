/*
 * The site's typeface.
 *
 * One family, everywhere: the tool, the content pages, the blog, the
 * storefront and the consent banner all read from here. Before this there were
 * four definitions of "the font" — two in duplicated theme files, one in a CSS
 * variable and one inlined in a banner — which is how a site ends up set in
 * three faces nobody chose.
 *
 * ── Where the font comes from ──
 *
 * News Gothic Std is an Adobe typeface. A desktop licence (the one that comes
 * with Creative Cloud, and the reason it is already on the studio's machines)
 * does NOT permit serving the files from a website, so it is not committed here
 * and never will be. Two legitimate routes:
 *
 *   1. Adobe Fonts web project — create one at fonts.adobe.com, add News Gothic
 *      Std, and set PRESSMARK_ADOBE_FONTS_KIT to the project id. vite.config.js
 *      puts the stylesheet in every page's <head> at build time.
 *
 *   2. A self-hosted licence — buy web fonts, drop the .woff2 files in public/
 *      and swap the loader for an @font-face block.
 *
 * Until one of those is in place the stack simply falls through, and anyone who
 * has News Gothic Std installed locally still sees it.
 *
 * ── The fallbacks ──
 *
 * Ordered by how close they are, not by how common. News Gothic MT and plain
 * "News Gothic" catch machines with the older Monotype or PostScript cuts;
 * Franklin Gothic is Benton's other American grotesque and the nearest thing
 * shipped with Windows; Trade Gothic is the nearest on a designer's Mac.
 * Helvetica Neue and Arial are the floor.
 */

export const FONT_FAMILY =
  "'News Gothic Std', 'News Gothic MT', 'News Gothic', " +
  "'Franklin Gothic', 'Franklin Gothic Medium', 'Trade Gothic', " +
  "'Helvetica Neue', Arial, sans-serif";

/*
 * The weights to design with.
 *
 * News Gothic Std ships Light, Roman, Medium and Bold — there is no black. A
 * heading set at 900 does not get a heavier cut; the browser fakes one by
 * smearing the Bold, which looks exactly as bad as it sounds. Everything on the
 * site is set from these four so nothing is ever synthesised.
 */
export const WEIGHT = {
  light: 300,
  regular: 400,
  medium: 500,
  bold: 700,
};
