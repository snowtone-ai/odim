export type RuntimeEnvironment = "local" | "staging" | "production";

function normalizeEnvironment(value?: string | null): RuntimeEnvironment {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "production") return "production";
  if (normalized === "staging" || normalized === "preview") return "staging";
  return "local";
}

export function getRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): RuntimeEnvironment {
  return normalizeEnvironment(env.ENVIRONMENT ?? env.ODIM_RUNTIME_ENV ?? env.VERCEL_ENV ?? "local");
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env) {
  return getRuntimeEnvironment(env) === "production";
}

export function isStagingRuntime(env: NodeJS.ProcessEnv = process.env) {
  return getRuntimeEnvironment(env) === "staging";
}

export function resolveRuntimeVar(baseName: string, env: NodeJS.ProcessEnv = process.env) {
  const runtime = getRuntimeEnvironment(env);
  if (runtime === "production") {
    return env[`PRODUCTION_${baseName}`] ?? env[`NEXT_PUBLIC_PRODUCTION_${baseName}`] ?? env[baseName];
  }
  if (runtime === "staging") {
    return env[`STAGING_${baseName}`] ?? env[`NEXT_PUBLIC_STAGING_${baseName}`] ?? env[baseName];
  }
  return env[baseName];
}

export function resolveSupabaseRuntimeEnv(env: NodeJS.ProcessEnv = process.env) {
  const runtime = getRuntimeEnvironment(env);
  if (runtime === "production") {
    return {
      url: env.NEXT_PUBLIC_SUPABASE_PRODUCTION_URL ?? env.SUPABASE_PRODUCTION_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey:
        env.NEXT_PUBLIC_SUPABASE_PRODUCTION_ANON_KEY ??
        env.SUPABASE_PRODUCTION_ANON_KEY ??
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_PRODUCTION_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
    };
  }
  if (runtime === "staging") {
    return {
      url: env.NEXT_PUBLIC_SUPABASE_STAGING_URL ?? env.SUPABASE_STAGING_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey:
        env.NEXT_PUBLIC_SUPABASE_STAGING_ANON_KEY ??
        env.SUPABASE_STAGING_ANON_KEY ??
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_STAGING_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
    };
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export function getSlackWebhookUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.SLACK_WEBHOOK_URL ?? null;
}

export function getSlackNotifyMinPriority(env: NodeJS.ProcessEnv = process.env) {
  return env.SLACK_NOTIFY_MIN_PRIORITY ?? "CRITICAL";
}

export const SLACK_WEBHOOK_URL = getSlackWebhookUrl();
export const SLACK_NOTIFY_MIN_PRIORITY = getSlackNotifyMinPriority();
