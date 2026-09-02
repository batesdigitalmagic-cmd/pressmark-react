/*
 * Color-role resolution.
 *
 * Template elements name a role — primary, secondary, paper, ink, onPrimary —
 * never a hex value. This resolves those roles against the customer's chosen
 * brand colors, which is what makes the proof look like their publication
 * rather than a stock sample.
 *
 * The customer's primary and secondary always win. Every other role falls back
 * to the template's own defaults, so a template can rely on `paper` and `ink`
 * existing without asking the customer to choose five colors.
 */

/**
 * @param {import('../templates/registry.js').DesignTemplate} template
 * @param {import('../models.js').VisualDirection} visual
 * @returns {Record<string,string>}
 */
export function resolveColors(template, visual) {
  return {
    ...template.defaultColors,
    primary: visual?.primaryColor || template.defaultColors.primary,
    secondary: visual?.secondaryColor || template.defaultColors.secondary,
  };
}
