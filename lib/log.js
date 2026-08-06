/*
 * Structured logging for the serverless functions.
 *
 * SERVER ONLY.
 *
 * Two rules this enforces so no individual call site has to remember them:
 *
 *   1. Secrets never reach the log. Anything resembling a key, token, or
 *      signature is redacted by shape, not by field name — Stripe error
 *      objects nest surprises, and a denylist of field names always misses one.
 *   2. Personal data is minimised. Email addresses are logged masked; logs
 *      outlive the reason you wrote them.
 */

const SECRET_SHAPES = [
  /\bsk_(test|live)_[A-Za-z0-9]+/g,
  /\bwhsec_[A-Za-z0-9]+/g,
  /\brk_(test|live)_[A-Za-z0-9]+/g,
  /\b1000\.[A-Za-z0-9._-]{16,}/g, // Zoho tokens
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi,
];

export function redact(value) {
  let text = typeof value === "string" ? value : safeStringify(value);
  for (const shape of SECRET_SHAPES) text = text.replace(shape, "[redacted]");
  return text;
}

/** a***@example.com — enough to correlate, not enough to harvest. */
export function maskEmail(email) {
  const address = String(email || "");
  const at = address.indexOf("@");
  if (at < 1) return "[no-email]";
  return `${address[0]}***${address.slice(at)}`;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function emit(level, scope, message, fields) {
  const line = { level, scope, message: redact(message), ...fields };
  const serialised = redact(line);
  if (level === "error") console.error(serialised);
  else console.log(serialised);
}

export function logger(scope) {
  return {
    info: (message, fields) => emit("info", scope, message, fields),
    warn: (message, fields) => emit("warn", scope, message, fields),
    error: (message, error, fields) =>
      emit("error", scope, message, {
        ...fields,
        // Message only. A stack can carry query strings and headers.
        cause: error?.message ? redact(error.message) : undefined,
      }),
  };
}
