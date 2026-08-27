import { AiProviderError } from "./errors.ts";

export type RequestBudgetOptions = {
  timeoutMs?: number;
  deadlineAt?: number;
  signal?: AbortSignal;
  now?: () => number;
};

export type RequestBudget = {
  readonly signal: AbortSignal;
  readonly deadlineAt: number;
  remainingMs: () => number;
  child: (timeoutMs?: number) => RequestBudget;
  dispose: () => void;
};

function positiveMs(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;
}

function defaultTimeoutMs() {
  return positiveMs(Number(process.env.AI_REQUEST_TIMEOUT_MS), 30_000);
}

export function createRequestBudget(options: RequestBudgetOptions = {}): RequestBudget {
  const now = options.now ?? Date.now;
  const timeoutMs = positiveMs(options.timeoutMs, defaultTimeoutMs());
  const deadlineAt = Math.min(options.deadlineAt ?? Number.POSITIVE_INFINITY, now() + timeoutMs);
  const controller = new AbortController();
  const parent = options.signal;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let disposed = false;

  const abortFromParent = () => {
    if (!controller.signal.aborted) controller.abort(parent?.reason);
  };
  if (parent) {
    if (parent.aborted) abortFromParent();
    else parent.addEventListener("abort", abortFromParent, { once: true });
  }

  const remainingMs = () => Math.max(0, deadlineAt - now());
  const timeout = remainingMs();
  if (Number.isFinite(timeout)) {
    timers.push(
      setTimeout(() => {
        if (!controller.signal.aborted) controller.abort("deadline");
      }, Math.max(0, timeout))
    );
  }

  const budget: RequestBudget = {
    signal: controller.signal,
    deadlineAt,
    remainingMs,
    child: (childTimeoutMs) =>
      createRequestBudget({
        timeoutMs: positiveMs(childTimeoutMs, remainingMs()),
        deadlineAt,
        signal: controller.signal,
        now
      }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      if (parent) parent.removeEventListener("abort", abortFromParent);
    }
  };
  return budget;
}

export function assertBudgetAvailable(budget: RequestBudget, provider: string): void {
  if (budget.signal.aborted) {
    if (budget.signal.reason !== "deadline" && budget.remainingMs() > 0) {
      throw new AiProviderError({
        kind: "aborted",
        provider,
        message: `${provider} request was aborted`,
        retryable: false,
        cause: budget.signal.reason
      });
    }
    throw new AiProviderError({
      kind: "timeout",
      provider,
      message: `${provider} request timed out`
    });
  }
  if (budget.remainingMs() <= 0) {
    throw new AiProviderError({
      kind: "timeout",
      provider,
      message: `${provider} request timed out`
    });
  }
}

export async function raceWithBudget<T>(task: Promise<T>, budget: RequestBudget, provider: string): Promise<T> {
  // Attach a rejection handler before checking an already-aborted signal. The
  // caller may have started a provider promise while the shared budget closed.
  void task.catch(() => undefined);
  assertBudgetAvailable(budget, provider);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new AiProviderError({
            kind: "timeout",
            provider,
            message: `${provider} request timed out`
          })
        ),
      Math.max(0, budget.remainingMs())
    );
    abortHandler = () => {
      if (budget.remainingMs() <= 0 || budget.signal.reason === "deadline") {
        reject(new AiProviderError({ kind: "timeout", provider, message: `${provider} request timed out` }));
      } else {
        reject(
          new AiProviderError({
            kind: "aborted",
            provider,
            message: `${provider} request was aborted`,
            retryable: false
          })
        );
      }
    };
    budget.signal.addEventListener("abort", abortHandler, { once: true });
  });

  try {
    return await Promise.race([task, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    if (abortHandler) budget.signal.removeEventListener("abort", abortHandler);
  }
}
