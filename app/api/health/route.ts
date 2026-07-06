import { getRuntimeEnvironment } from "../../../lib/env/runtime.ts";
import { hasSupabaseReadEnv, hasSupabaseWriteEnv } from "../../../lib/supabase/client.ts";

export const dynamic = "force-dynamic";

/**
 * Public liveness/readiness probe for uptime monitors and load balancers.
 * Intentionally unauthenticated; must expose only non-sensitive booleans.
 */
export async function GET() {
  const checks = {
    supabaseRead: hasSupabaseReadEnv(),
    supabaseWrite: hasSupabaseWriteEnv(),
    aiProviderConfigured: Boolean(process.env.AI_PROVIDER)
  };

  return Response.json(
    {
      status: "ok",
      runtime: getRuntimeEnvironment(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
