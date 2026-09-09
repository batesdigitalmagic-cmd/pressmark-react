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
 * with no test doubles — and it talks to the REAL Upstash and Blob stores. What
 * differs from production is only the HTTP plumbing: Vercel's runtime builds
 * the `Request` and writes the `Response`, and here this file does. Handlers
 * receive a standard `Request` and return a standard `Response` either way.
 *
 * So a success here proves the pipeline, the storage and the worker. It does
 * NOT prove Vercel's routing, its function config, or its Edge/Node split —
 * only a deploy proves those.
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

/** Node's IncomingMessage -> a standard Request the handlers understand. */
async function toRequest(nodeRequest) {
  const url = `http://${HOST}:${PORT}${nodeRequest.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
    else if (value !== undefined) headers.set(key, value);
  }

  const method = nodeRequest.method || "GET";
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });

  /* Buffer the body. Uploads here are a CSV (≤2 MiB) or a PDF (≤100 MiB);
     streaming would be faithful to Vercel but adds nothing to what we are
     trying to prove. */
  const chunks = [];
  for await (const chunk of nodeRequest) chunks.push(chunk);
  return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}

async function send(nodeResponse, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  nodeResponse.writeHead(response.status, headers);
  if (response.body) {
    nodeResponse.end(Buffer.from(await response.arrayBuffer()));
  } else {
    nodeResponse.end();
  }
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
    const response = await handler(await toRequest(nodeRequest));
    /* Method, path and status only. Never a body: those carry customer CSV
       rows, PDF bytes and job ids. */
    console.log(
      `${nodeRequest.method} ${pathname.replace(/\/[a-f0-9]{64}/g, "/<jobId>")} -> ${response.status} (${Date.now() - started}ms)`
    );
    await send(nodeResponse, response);
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
