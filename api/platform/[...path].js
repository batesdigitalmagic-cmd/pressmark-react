/*
 * /api/platform/* — customer accounts, organizations, projects and production
 * jobs. Every route lives in lib/platform/api.js; see there for the model.
 */

import { toNodeHandler } from "../../lib/render-jobs/node-adapter.js";
import { handlePlatform } from "../../lib/platform/api.js";

export default toNodeHandler(handlePlatform);
