import type { ProviderErrorKind, RuntimeProviderName } from "./types.ts";

const retryableKinds = new Set<ProviderErrorKind>(["timeout", "rate_limit", "server", "network"]);

export class AiProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: RuntimeProviderName | string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(input: {
    kind: ProviderErrorKind;
    provider: RuntimeProviderName | string;
    message: string;
    status?: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "AiProviderError";
    this.kind = input.kind;
    this.provider = input.provider;
    this.status = input.status;
    this.retryable = input.retryable ?? retryableKinds.has(input.kind);
    this.cause = input.cause;
  }
}

export function isAiProviderError(error: unknown): error is AiProviderError {
  return error instanceof AiProviderError;
}

export function providerHttpError(provider: RuntimeProviderName | string, status: number): AiProviderError {
  const kind: ProviderErrorKind =
    status === 408 || status === 504
      ? "timeout"
      : status === 401 || status === 403
        ? "auth"
        : status === 400 || status === 404 || status === 422
          ? "invalid_request"
          : status === 429
            ? "rate_limit"
            : status >= 500
              ? "server"
              : "unknown";
  return new AiProviderError({
    kind,
    provider,
    status,
    message: `${provider} request failed (${status})`
  });
}

export function classifyProviderError(
  error: unknown,
  input: { provider: RuntimeProviderName | string; deadlineAt?: number; signal?: AbortSignal }
): AiProviderError {
  if (isAiProviderError(error)) return error;

  const timedOut = input.deadlineAt !== undefined && Date.now() >= input.deadlineAt;
  if (timedOut) {
    return new AiProviderError({
      kind: "timeout",
      provider: input.provider,
      message: `${input.provider} request timed out`
    });
  }

  if (input.signal?.aborted) {
    return new AiProviderError({
      kind: "aborted",
      provider: input.provider,
      message: `${input.provider} request was aborted`,
      retryable: false,
      cause: input.signal.reason
    });
  }

  if (error instanceof SyntaxError) {
    return new AiProviderError({
      kind: "parse",
      provider: input.provider,
      message: `${input.provider} returned invalid JSON`,
      retryable: false,
      cause: error
    });
  }

  if (error instanceof TypeError) {
    return new AiProviderError({
      kind: "network",
      provider: input.provider,
      message: `${input.provider} request failed at the network boundary`,
      cause: error
    });
  }

  return new AiProviderError({
    kind: "unknown",
    provider: input.provider,
    message: `${input.provider} request failed`,
    retryable: false,
    cause: error
  });
}

export function structuredParseError(provider: RuntimeProviderName | string, message = "invalid structured output") {
  return new AiProviderError({
    kind: "parse",
    provider,
    message: `${provider} returned ${message}`,
    retryable: false
  });
}

export function emptyProviderResponseError(provider: RuntimeProviderName | string, reason = "empty output") {
  return new AiProviderError({
    kind: "parse",
    provider,
    message: `${provider} returned ${reason}`,
    retryable: false
  });
}

export function circuitOpenError(provider: RuntimeProviderName | string) {
  return new AiProviderError({
    kind: "circuit_open",
    provider,
    message: `${provider} circuit is open`,
    retryable: true
  });
}
