/* Sandbox portal. Reads and writes only the sandbox: Redis namespace. */
import { TEST } from "../../../lib/licenses.js";
import { makeRequestCode } from "../../../lib/portal-handlers.js";

export const config = { runtime: "edge" };
export default makeRequestCode(TEST);
