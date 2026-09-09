import { timingSafeEqual } from "node:crypto";

export function workerAuthorized(request) {
  const configured = (process.env.PRESSMARK_WORKER_TOKEN || "").trim();
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!configured || !supplied) return false;
  const expected = Buffer.from(configured), actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
