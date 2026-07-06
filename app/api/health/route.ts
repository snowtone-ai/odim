import { getRuntimeEnvironment } from "../../../lib/env/runtime.ts";
import { errorTrackingEnabled } from "../../../lib/observability/error-tracking.ts";
import { snapshotApiMetrics } from "../../../lib/observability/metrics.ts";
import { probeSupabase } from "../../../lib/observability/probes.ts";
import { hasSupabaseReadEnv, hasSupabaseWriteEnv } from "../../../lib/supabase/client.ts";

export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness probe for uptime monitors and load balancers.
 * Intentionally unauthenticated; must expose only non-sensitive booleans,
 * latencies, and aggregate counters — never URLs, identifiers, or key material.
 */
export async function GET() {
  const checks = {
    supabaseRead: hasSupabaseReadEnv(),
    supabaseWrite: hasSupabaseWriteEnv(),
    aiProviderConfigured: Boolean(process.env.AI_PROVIDER),
    errorTracking: errorTrackingEnabled()
  };

  const supabase = await probeSupabase();
  const metrics = snapshotApiMetrics();

  return Response.json(
    {
      status: "ok",
      runtime: getRuntimeEnvironment(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
      dependencies: { supabase },
      metrics: {
        requests: metrics.totalRequests,
        errors: metrics.totalErrors,
        errorRate: metrics.errorRate
      }
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
