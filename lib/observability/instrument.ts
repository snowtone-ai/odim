import { reportError } from "./error-tracking.ts";
import { logApiRequest } from "./logger.ts";
import { recordApiError, recordApiOutcome } from "./metrics.ts";

/**
 * Wraps an API route handler with structured request logging, error-rate
 * counters, and error-tracking delivery. The handler's signature is preserved
 * so Next.js route type checking sees the original parameter types.
 */
export function instrumentApiRoute<Args extends [Request, ...unknown[]]>(
  route: string,
  handler: (...args: Args) => Promise<Response> | Response
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    const request = args[0];
    const startedAt = Date.now();
    try {
      const response = await handler(...args);
      recordApiOutcome(route, response.status);
      if (response.status >= 500) recordApiError(route, response.status, "handler returned a server error");
      logApiRequest({ route, method: request.method, status: response.status, durationMs: Date.now() - startedAt });
      return response;
    } catch (error) {
      recordApiOutcome(route, 500);
      recordApiError(route, 500, error instanceof Error ? error.message : String(error));
      logApiRequest({ route, method: request.method, status: 500, durationMs: Date.now() - startedAt });
      await reportError(error, { route, method: request.method });
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
