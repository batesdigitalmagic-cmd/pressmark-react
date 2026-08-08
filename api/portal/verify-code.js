/* Live portal. Mode is bound here and never read from the request — see
   lib/portal-handlers.js. */
import { LIVE } from "../../lib/licenses.js";
import { makeVerifyCode } from "../../lib/portal-handlers.js";

export const config = { runtime: "edge" };
export default makeVerifyCode(LIVE);
