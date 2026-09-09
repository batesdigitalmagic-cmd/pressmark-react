/*
 * A local host for the render-job API functions.
 *
 *   node --env-file=.env --env-file=.env.render --env-file=.env.local \
 *     scripts/dev-api-server.mjs
 *
 * ── Why this exists ──
 *
 * `api/**` are Vercel Functions. `vite dev` serves the site but not them, so
 * there is no way to exercise the pipeline locally without either deploying or
 * hosting the handlers ourselves. Deploying first would mean shipping unproven
 * code to production, which is precisely the thing we are trying to avoid.
 *
 * ── What it is and is not ──
 *
 * It imports and calls the REAL handler modules — the same files Vercel runs,
 * with no test doubles — and it talks to the REAL Upstash and Blob stores.
 *
 * ── It hands them a raw Node request, exactly as Vercel does ──
 *
 * This file used to convert IncomingMessage into a Web `Request` before calling
 * a handler. That felt harmless and was not: Vercel's Node runtime performs no
 * such conversion, so the handlers were only ever exercised against a shape
 * that existed here and nowhere else. Every endpoint passed locally and then
 * died in production on `request.headers.get is not a function`.
 *
 * The conversion now lives in lib/render-jobs/node-adapter.js, which wraps each
 * endpoint's default export — so this host calls handlers exactly as Vercel
 * does, and a mismatch of this kind cannot hide here again.
 *
 * What still differs from production is only routing: Vercel maps files to
 * paths, and here `route()` does. A success here proves the pipeline, the
 * storage, the runtime bridge and the worker; it does not prove Vercel's own
 * file-based routing or function config.
 *
 * Development only. Never deployed, never reachable from outside this machine.
 */

import { createServer } from "node:http";
import { renderStorageStatus } from "../lib/render-jobs/storage.js";

const PORT = Number(process.env.PRESSMARK_DEV_API_PORT) || 3100;
/* Loopback only. This process holds live production storage credentials; it
   must not be reachable from the network. */
const HOST = "127.0.0.1";

const handlers = {
  submit: (await import("../api/render-jobs/index.js")).default,
  status: (await import("../api/render-jobs/[jobId].js")).default,
  download: (await import("../api/render-jobs/[jobId]/download.js")).default,
  cleanup: (await import("../api/render-jobs/cleanup.js")).default,
  claim: (await import("../api/render-jobs/worker/claim.js")).default,
  input: (await import("../api/render-jobs/worker/[jobId]/input.js")).default,
  heartbeat: (await import("../api/render-jobs/worker/[jobId]/heartbeat.js")).default,
  result: (await import("../api/render-jobs/worker/[jobId]/result.js")).default,
};

/* Vercel's file-based routing, expressed as patterns. Order matters: the more
   specific worker routes are tested before the bare job route. */
function route(pathname) {
  if (pathname === "/api/render-jobs") return handlers.submit;
  if (pathname === "/api/render-jobs/cleanup") return handlers.cleanup;
  if (pathname === "/api/render-jobs/worker/claim") return handlers.claim;

  let match = pathname.match(/^\/api\/render-jobs\/worker\/([^/]+)\/(input|heartbeat|result)$/);
  if (match) return handlers[match[2]];

  match = pathname.match(/^\/api\/render-jobs\/([^/]+)\/download$/);
  if (match) return handlers.download;

  match = pathname.match(/^\/api\/render-jobs\/([^/]+)$/);
  if (match) return handlers.status;

  return null;
}

const server = createServer(async (nodeRequest, nodeResponse) => {
  const { pathname } = new URL(nodeRequest.url, `http://${HOST}:${PORT}`);
  const handler = route(pathname);

  if (!handler) {
    nodeResponse.writeHead(404, { "Content-Type": "application/json" });
    nodeResponse.end(JSON.stringify({ error: "No such route in the dev API host." }));
    return;
  }

  const started = Date.now();
  try {
    /* Node-style, exactly as Vercel invokes it. The handler's own adapter does
       the conversion; this host must not do it for them. */
    await handler(nodeRequest, nodeResponse);
    /* Method, path and status only. Never a body: those carry customer CSV
       rows, PDF bytes and job ids. */
    console.log(
      `${nodeRequest.method} ${pathname.replace(/\/[a-f0-9]{64}/g, "/<jobId>")} -> ${nodeResponse.statusCode} (${Date.now() - started}ms)`
    );
  } catch (error) {
    console.error(`${nodeRequest.method} ${pathname} -> 500`, error?.message);
    nodeResponse.writeHead(500, { "Content-Type": "application/json" });
    nodeResponse.end(JSON.stringify({ error: "Dev API host failed." }));
  }
});

const storage = renderStorageStatus();
server.listen(PORT, HOST, () => {
  console.log(`Pressmark dev API host on http://${HOST}:${PORT} (loopback only)`);
  console.log(`  render storage: ${storage.ready ? "configured" : storage.detail}`);
  if (process.env.PRESSMARK_RENDER_STORAGE === "local") {
    console.log("  WARNING: PRESSMARK_RENDER_STORAGE=local — this is NOT testing durable storage.");
  }
});
