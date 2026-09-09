/*
 * Structured logging with redaction.
 *
 * ── What must never appear in a log line ──
 *
 *   the worker token, any customer name, address, phone or email, and the
 *   contents of any CSV.
 *
 * The worker therefore logs job IDS, COUNTS and STAGES — never field values.
 * `redact()` is a second line of defence for values that reach a log by an
 * indirect route (an error message quoting a response body, say), not a licence
 * to pass customer data through it.
 */

const TOKEN_PATTERN = /\b[a-f0-9]{32,}\b/gi;
const BEARER_PATTERN = /Bearer\s+\S+/gi;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Strip anything that looks like a credential or a personal detail.
 *
 * Job ids are 64 hex characters and would match TOKEN_PATTERN, so they are
 * masked here too — callers pass the job id as its own structured field, where
 * it is truncated to a readable prefix rather than redacted outright.
 */
export function redact(value) {
  return String(value ?? "")
    .replace(BEARER_PATTERN, "Bearer <redacted>")
    .replace(TOKEN_PATTERN, "<redacted>")
    .replace(EMAIL_PATTERN, "<redacted-email>");
}

/* Enough to correlate with the server, short enough not to be a usable
   capability if a log is shared. */
export const shortJobId = (jobId) => String(jobId || "").slice(0, 8);

function emit(level, message, fields = {}) {
  const line = {
    at: new Date().toISOString(),
    level,
    message: redact(message),
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    line[key] = typeof value === "string" ? redact(value) : value;
  }
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(line)}\n`);
}

export const log = {
  info: (message, fields) => emit("info", message, fields),
  warn: (message, fields) => emit("warn", message, fields),
  error: (message, fields) => emit("error", message, fields),
};
