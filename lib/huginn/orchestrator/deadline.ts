import { HuginnExecutionError } from "./types.ts";

export const HUGINN_DEFAULT_DEADLINE_MS = 12_000;
export const HUGINN_MAX_DEADLINE_MS = 15_000;

function boundedTimeout(value: number | undefined) {
  const configured = Number(process.env.HUGINN_DEADLINE_MS);
  const fallback = Number.isFinite(configured) && configured > 0 ? configured : HUGINN_DEFAULT_DEADLINE_MS;
  const requested = Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
  return Math.min(HUGINN_MAX_DEADLINE_MS, Math.max(1, Math.floor(requested)));
}

export type HuginnDeadline = {
  signal: AbortSignal;
  deadlineAt: number;
  remainingMs: () => number;
  race: <T>(task: Promise<T>) => Promise<T>;
  dispose: () => void;
};

/** A request-wide deadline; every child phase shares the same cancellation signal. */
export function createHuginnDeadline(input: { signal?: AbortSignal; deadlineAt?: number; timeoutMs?: number; now?: () => number } = {}): HuginnDeadline {
  const now = input.now ?? Date.now;
  const startedAt = now();
  const configuredDeadline = startedAt + boundedTimeout(input.timeoutMs);
  const callerDeadline = Number.isFinite(input.deadlineAt) ? (input.deadlineAt as number) : Number.POSITIVE_INFINITY;
  const deadlineAt = Math.min(configuredDeadline, callerDeadline);
  const controller = new AbortController();
  const parent = input.signal;
  let disposed = false;

  const abortFromParent = () => {
    if (!controller.signal.aborted) controller.abort(parent?.reason ?? "aborted");
  };
  if (parent) {
    if (parent.aborted) abortFromParent();
    else parent.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeout = setTimeout(() => {
    if (!controller.signal.aborted) controller.abort("deadline");
  }, Math.max(0, deadlineAt - startedAt));

  const remainingMs = () => Math.max(0, deadlineAt - now());
  const errorForSignal = () => {
    const deadlineExceeded = controller.signal.reason === "deadline" || remainingMs() <= 0;
    return new HuginnExecutionError({
      code: deadlineExceeded ? "deadline_exceeded" : "aborted",
      message: deadlineExceeded ? "Huginn request exceeded its deadline" : "Huginn request was aborted",
      retryable: deadlineExceeded
    });
  };

  return {
    signal: controller.signal,
    deadlineAt,
    remainingMs,
    async race<T>(task: Promise<T>) {
      // A task can outlive the caller after cancellation; attach a handler so
      // that its eventual rejection never becomes an unhandled rejection.
      void task.catch(() => undefined);
      if (controller.signal.aborted || remainingMs() <= 0) throw errorForSignal();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      const timeoutOrAbort = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(errorForSignal()), Math.max(0, remainingMs()));
        onAbort = () => reject(errorForSignal());
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      try {
        return await Promise.race([task, timeoutOrAbort]);
      } finally {
        if (timer) clearTimeout(timer);
        if (onAbort) controller.signal.removeEventListener("abort", onAbort);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout);
      if (parent) parent.removeEventListener("abort", abortFromParent);
    }
  };
}
