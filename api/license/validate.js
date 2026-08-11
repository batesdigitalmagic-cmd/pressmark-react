/*
 * /api/license/validate
 *
 * One handler in activate.js serves activate, validate, and deactivate,
 * branching on the final path segment. Only the handler is re-exported.
 *
 * The runtime declaration MUST be written literally here, not re-exported.
 * Vercel detects the Edge runtime by statically scanning each route file for
 * `export const config = { runtime: "edge" }`; a re-export is not statically
 * analysable, so the route silently deploys on the Node runtime instead. An
 * Edge-style (request) => Response handler never writes to the Node response
 * object, so the function hangs on GET and 500s on POST — which is exactly
 * what this file previously did in production.
 */

export const config = { runtime: "edge" };

export { default } from "./activate.js";
