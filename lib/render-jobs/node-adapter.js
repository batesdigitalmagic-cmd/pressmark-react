/*
 * Bridging Vercel's Node runtime to handlers written against Web Request/Response.
 *
 * SERVER ONLY. Never import from src/.
 *
 * ── The bug this exists to fix ──
 *
 * Vercel runs `api/**` on one of two runtimes, and they do not agree on what a
 * handler is handed:
 *
 *   runtime: "edge"    handler(request: Request) => Response
 *   runtime: "nodejs"  handler(req: IncomingMessage, res: ServerResponse)
 *
 * The render-job handlers were written in the Web style — `request.headers.get`,
 * `return new Response(...)` — but they use `node:crypto`, `node:path` and
 * `node:fs`, so they run on the Node runtime, which handed them an
 * IncomingMessage. Every one of them died on the first line that touched
 * headers:
 *
 *   TypeError: request.headers.get is not a function
 *       at workerAuthorized (lib/render-jobs/auth.js:5)
 *
 * The local dev host (scripts/dev-api-server.mjs) performed this conversion
 * itself, so the handlers were never exercised against the shape production
 * actually delivers, and the whole suite passed against an interface that only
 * existed in testing. Both now go through this one adapter, so there is nothing
 * left for the dev host to paper over.
 *
 * ── Why it accepts both call shapes ──
 *
 * `toNodeHandler` returns a function that works when called EITHER way:
 *
 *   fn(request)        -> treated as a Web-style call, returns a Response
 *   fn(req, res)       -> treated as a Node-style call, writes to res
 *
 * That is deliberate rather than clever. The alternative — a Web export for the
 * tests and a Node export for Vercel — means the test suite exercises a
 * different entry point from the one production invokes, which is precisely how
 * this bug survived a green suite and a full local end-to-end run. With one
 * dual-shape export, `npm run test:render-jobs` calls exactly the function
 * Vercel calls.
 */

/** A Web Request carries a Headers object; an IncomingMessage carries a POJO. */
const isWebRequest = (value) =>
  Boolean(value) && typeof value.headers?.get === "function" && typeof value.url === "string";

/** Node's IncomingMessage -> a standard Request. */
async function toWebRequest(nodeRequest) {
  /*
   * IncomingMessage.url is a path, not an absolute URL, and `new URL()` needs
   * an origin. The forwarded host is what the caller actually addressed, which
   * matters because jobIdFrom() parses the pathname out of it.
   */
  const host =
    nodeRequest.headers["x-forwarded-host"] || nodeRequest.headers.host || "localhost";
  const proto = nodeRequest.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${host}${nodeRequest.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeRequest.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(key, entry));
    else if (value !== undefined) headers.set(key, String(value));
  }

  const method = nodeRequest.method || "GET";
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });

  /*
   * Buffer the body. Vercel may have parsed it already (req.body), in which
   * case the stream is spent and reading it would hang — so the parsed value is
   * used when present. Uploads here are a CSV (≤2 MiB) or a PDF (≤100 MiB).
   */
  if (nodeRequest.body !== undefined && nodeRequest.body !== null) {
    const body =
      typeof nodeRequest.body === "string" || Buffer.isBuffer(nodeRequest.body)
        ? nodeRequest.body
        : JSON.stringify(nodeRequest.body);
    return new Request(url, { method, headers, body });
  }

  const chunks = [];
  for await (const chunk of nodeRequest) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  /* A zero-length body must be omitted entirely; passing an empty buffer makes
     `new Request` reject for some methods. */
  return new Request(url, { method, headers, body: body.length > 0 ? body : undefined });
}

/** Write a Response out through a ServerResponse. */
async function writeWebResponse(nodeResponse, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  nodeResponse.writeHead(response.status, headers);

  if (!response.body) {
    nodeResponse.end();
    return;
  }
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
}

/**
 * Wrap a Web-style handler so Vercel's Node runtime can invoke it.
 *
 * @param {(request: Request) => Promise<Response>} webHandler
 */
export function toNodeHandler(webHandler) {
  return async function handler(requestOrNodeRequest, nodeResponse) {
    /* Web-style call: tests and anything holding a real Request. */
    if (nodeResponse === undefined && isWebRequest(requestOrNodeRequest)) {
      return webHandler(requestOrNodeRequest);
    }

    /* Node-style call: Vercel's Node runtime. */
    try {
      const response = await webHandler(await toWebRequest(requestOrNodeRequest));
      await writeWebResponse(nodeResponse, response);
    } catch (error) {
      /* The handlers catch their own errors; reaching here means the bridge
         itself failed. Say nothing specific — this goes to a shared log. */
      console.error("[render-jobs] node adapter failed:", error?.message || "unknown");
      if (!nodeResponse.headersSent) {
        nodeResponse.writeHead(500, { "Content-Type": "application/json" });
      }
      nodeResponse.end(JSON.stringify({ error: "The render job request could not be completed." }));
    }
    return undefined;
  };
}
