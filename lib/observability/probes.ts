import { resolveSupabaseRuntimeEnv } from "../env/runtime.ts";

export type DependencyProbe = {
  configured: boolean;
  ok?: boolean;
  latencyMs?: number;
};

/**
 * Measures Supabase REST reachability and latency without leaking the project
 * URL or credentials into the response. Bounded by a hard timeout so health
 * checks stay fast even when the dependency hangs.
 */
export async function probeSupabase(
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<DependencyProbe> {
  const env = options.env ?? process.env;
  const { url, anonKey, serviceRoleKey } = resolveSupabaseRuntimeEnv(env);
  const restKey = serviceRoleKey || anonKey;
  if (!url || !restKey) return { configured: false };
  const fetchImpl = options.fetchImpl ?? fetch;
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(`${url.replace(/\/+$/, "")}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: restKey },
      signal: AbortSignal.timeout(options.timeoutMs ?? 1500)
    });
    // 4xx still proves the service is reachable; only 5xx/timeout means down.
    return { configured: true, ok: response.status < 500, latencyMs: Date.now() - startedAt };
  } catch {
    return { configured: true, ok: false, latencyMs: Date.now() - startedAt };
  }
}
