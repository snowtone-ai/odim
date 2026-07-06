export type LogLevel = "debug" | "info" | "warn" | "error";

// Field names that must never reach a log sink, regardless of value.
const SECRET_FIELD_PATTERN = /(authorization|cookie|credential|dsn|password|secret|signature|token|key)/i;
// Value shapes that look like issued tokens or JWTs, scrubbed defensively.
const TOKEN_VALUE_PATTERN = /odim_[a-z]+_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{10,}/g;
// Credentials embedded in connection strings (postgres://user:pass@host, etc.).
const URL_CREDENTIAL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s@]+@/gi;
const MAX_FIELD_LENGTH = 500;

type LogFieldValue = string | number | boolean | null;

export function scrubSecretTextShapes(text: string) {
  return text.replace(TOKEN_VALUE_PATTERN, "[redacted]").replace(URL_CREDENTIAL_PATTERN, "[redacted]@");
}

function sanitizeValue(value: unknown): LogFieldValue {
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  const text = typeof value === "string" ? value : (JSON.stringify(value) ?? String(value));
  const scrubbed = scrubSecretTextShapes(text);
  return scrubbed.length > MAX_FIELD_LENGTH ? `${scrubbed.slice(0, MAX_FIELD_LENGTH)}…` : scrubbed;
}

/**
 * Redaction is by top-level field name plus token/credential value shapes.
 * Nested objects are stringified and value-scrubbed only — do not pass nested
 * structures whose inner keys alone mark them as sensitive.
 */
export function redactLogFields(fields: Record<string, unknown>) {
  const result: Record<string, LogFieldValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    result[key] = SECRET_FIELD_PATTERN.test(key) ? "[redacted]" : sanitizeValue(value);
  }
  return result;
}

export function formatLogLine(level: LogLevel, event: string, fields: Record<string, unknown> = {}, now = new Date()) {
  return JSON.stringify({ ts: now.toISOString(), level, event, ...redactLogFields(fields) });
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const line = formatLogLine(level, event, fields);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function requestLoggingEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.REQUEST_LOGGING !== "false";
}

export type ApiRequestLog = {
  route: string;
  method: string;
  status: number;
  durationMs: number;
  orgId?: string;
};

export function logApiRequest(input: ApiRequestLog) {
  if (!requestLoggingEnabled()) return;
  const level: LogLevel = input.status >= 500 ? "error" : input.status >= 400 ? "warn" : "info";
  logEvent(level, "api.request", { ...input });
}
