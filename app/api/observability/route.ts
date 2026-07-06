import { authorizeApiRequest } from "../../../lib/auth/request.ts";
import { errorTrackingEnabled } from "../../../lib/observability/error-tracking.ts";
import { requestLoggingEnabled } from "../../../lib/observability/logger.ts";
import { snapshotApiMetrics } from "../../../lib/observability/metrics.ts";

export const dynamic = "force-dynamic";

/**
 * Admin-scoped operational snapshot: per-route request/error counters and the
 * recent error ring buffer. Route names and error messages are internal
 * detail, so this stays behind admin:read (unlike the public /api/health).
 */
export async function GET(request: Request) {
  try {
    const auth = await authorizeApiRequest(request, "admin:read");
    if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
    return Response.json(
      {
        metrics: snapshotApiMetrics(),
        errorTracking: { enabled: errorTrackingEnabled() },
        requestLogging: { enabled: requestLoggingEnabled() },
        timestamp: new Date().toISOString()
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("observability route failed", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
