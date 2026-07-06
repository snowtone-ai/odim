import { getRuntimeEnvironment } from "../env/runtime.ts";
import { logEvent, redactLogFields } from "./logger.ts";

export type ParsedSentryDsn = {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
};

/**
 * Sentry-compatible error tracking without the SDK: events are delivered as
 * envelopes over plain fetch, so any Sentry-protocol sink (Sentry SaaS,
 * self-hosted, GlitchTip) works. Disabled unless SENTRY_DSN is set.
 */
export function parseSentryDsn(dsn: string | undefined): ParsedSentryDsn | undefined {
  if (!dsn) return undefined;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, "");
    if (!url.username || !url.host || !/^\d+$/.test(projectId)) return undefined;
    return { protocol: url.protocol.replace(":", ""), publicKey: url.username, host: url.host, projectId };
  } catch {
    return undefined;
  }
}

export function errorTrackingEnabled(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(parseSentryDsn(env.SENTRY_DSN));
}

export function buildSentryEnvelope(input: {
  error: unknown;
  context?: Record<string, unknown>;
  environment: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const eventId = crypto.randomUUID().replaceAll("-", "");
  const type = input.error instanceof Error ? input.error.name : "Error";
  const value = input.error instanceof Error ? input.error.message : String(input.error);
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    platform: "javascript",
    level: "error",
    environment: input.environment,
    exception: { values: [{ type, value: value.slice(0, 500) }] },
    tags: { app: "odim" },
    extra: redactLogFields(input.context ?? {})
  };
  const envelopeHeader = JSON.stringify({ event_id: eventId, sent_at: now.toISOString() });
  const itemHeader = JSON.stringify({ type: "event" });
  return { eventId, body: `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}` };
}

export type ErrorReportResult = {
  delivered: boolean;
  reason: "sent" | "disabled" | "rejected" | "network";
};

/**
 * Logs the error locally (always) and forwards it to the configured tracking
 * sink (when enabled). Never throws: delivery failures are logged and reported
 * in the result so callers stay on their own error path.
 */
export async function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<ErrorReportResult> {
  const env = options.env ?? process.env;
  const message = error instanceof Error ? error.message : String(error);
  logEvent("error", "app.error", { message, ...context });

  const dsn = parseSentryDsn(env.SENTRY_DSN);
  if (!dsn) return { delivered: false, reason: "disabled" };

  const { body } = buildSentryEnvelope({ error, context, environment: getRuntimeEnvironment(env) });
  const endpoint = `${dsn.protocol}://${dsn.host}/api/${dsn.projectId}/envelope/`;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=odim/0.1.0, sentry_key=${dsn.publicKey}`
      },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 3000)
    });
    if (!response.ok) {
      logEvent("warn", "error_tracking.rejected", { status: response.status });
      return { delivered: false, reason: "rejected" };
    }
    return { delivered: true, reason: "sent" };
  } catch (deliveryError) {
    logEvent("warn", "error_tracking.delivery_failed", {
      message: deliveryError instanceof Error ? deliveryError.message : String(deliveryError)
    });
    return { delivered: false, reason: "network" };
  }
}
