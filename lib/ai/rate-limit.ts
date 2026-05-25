import { isProductionRuntime } from "../env/runtime.ts";
import { createServiceSupabaseClient, hasSupabaseWriteEnv } from "../supabase/client.ts";

export type AiRateLimits = {
  rpm: number;
  rpd: number;
  tpm: number;
};

const geminiFreeTierDefaults: Record<string, AiRateLimits> = {
  "gemini-2.5-flash": { rpm: 10, rpd: 250, tpm: 250000 },
  "gemini-2.5-flash-lite": { rpm: 15, rpd: 1000, tpm: 250000 },
  "gemini-2.0-flash": { rpm: 15, rpd: 200, tpm: 1000000 }
};

type UsageBucket = {
  minuteStartedAt: number;
  dayKey: string;
  minuteRequests: number;
  minuteTokens: number;
  dayRequests: number;
};

const usageByTenantModel = new Map<string, UsageBucket>();

function numberEnv(name: string, fallback: number, env: NodeJS.ProcessEnv) {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function defaultFreeLimits(model: string): AiRateLimits {
  const normalized = model.toLowerCase();
  const match = Object.entries(geminiFreeTierDefaults).find(([key]) => normalized.includes(key));
  return match?.[1] ?? geminiFreeTierDefaults["gemini-2.5-flash"];
}

export function resolveAiRateLimits(model: string, env: NodeJS.ProcessEnv = process.env): AiRateLimits {
  const free = defaultFreeLimits(model);
  if (env.AI_RATE_LIMIT_TIER === "paid") {
    return {
      rpm: numberEnv("AI_MAX_RPM", free.rpm, env),
      rpd: numberEnv("AI_MAX_RPD", free.rpd, env),
      tpm: numberEnv("AI_MAX_TPM", free.tpm, env)
    };
  }

  return {
    rpm: Math.min(numberEnv("AI_MAX_RPM", free.rpm, env), free.rpm),
    rpd: Math.min(numberEnv("AI_MAX_RPD", free.rpd, env), free.rpd),
    tpm: Math.min(numberEnv("AI_MAX_TPM", free.tpm, env), free.tpm)
  };
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function dayKeyFor(now: Date) {
  return now.toISOString().slice(0, 10);
}

function minuteKeyFor(now: Date) {
  return now.toISOString().slice(0, 16);
}

function shouldFallbackFromSupabaseError(message: string) {
  if (isProductionRuntime()) return false;
  if (process.env.REPOSITORY_SUPABASE_STRICT === "true") return false;
  return /schema cache|does not exist|Could not find the function|Could not find the table|relation .* does not exist|column .* does not exist/i.test(message);
}

export function resetAiRateLimitUsage() {
  usageByTenantModel.clear();
}

export function assertAiRateLimitAvailable(input: {
  model: string;
  estimatedTokens: number;
  orgId?: string;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}) {
  const now = input.now ?? new Date();
  const limits = resolveAiRateLimits(input.model, input.env);
  const key = `${input.orgId ?? "public"}:${input.model.toLowerCase()}`;
  const startedAt = now.valueOf();
  const current = usageByTenantModel.get(key);
  const bucket =
    current && startedAt - current.minuteStartedAt < 60_000 && current.dayKey === dayKeyFor(now)
      ? current
      : {
          minuteStartedAt: startedAt,
          dayKey: dayKeyFor(now),
          minuteRequests: current && startedAt - current.minuteStartedAt < 60_000 ? current.minuteRequests : 0,
          minuteTokens: current && startedAt - current.minuteStartedAt < 60_000 ? current.minuteTokens : 0,
          dayRequests: current?.dayKey === dayKeyFor(now) ? current.dayRequests : 0
        };

  if (bucket.minuteRequests + 1 > limits.rpm) throw new Error(`AI free-tier RPM limit reached for ${input.model}`);
  if (bucket.dayRequests + 1 > limits.rpd) throw new Error(`AI free-tier RPD limit reached for ${input.model}`);
  if (bucket.minuteTokens + input.estimatedTokens > limits.tpm) throw new Error(`AI free-tier TPM limit reached for ${input.model}`);

  bucket.minuteRequests += 1;
  bucket.minuteTokens += input.estimatedTokens;
  bucket.dayRequests += 1;
  usageByTenantModel.set(key, bucket);
}

export async function assertAiRateLimitAvailableForRequest(input: {
  model: string;
  estimatedTokens: number;
  orgId?: string;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}) {
  const env = input.env ?? process.env;
  const useShared = env.AI_RATE_LIMIT_BACKEND === "supabase";
  if (!useShared) {
    assertAiRateLimitAvailable(input);
    return;
  }

  if (!hasSupabaseWriteEnv()) {
    if (env.AI_RATE_LIMIT_SHARED_REQUIRED === "true" || isProductionRuntime()) {
      throw new Error("AI_RATE_LIMIT_BACKEND=supabase requires Supabase service-role write env");
    }
    assertAiRateLimitAvailable(input);
    return;
  }

  const now = input.now ?? new Date();
  const limits = resolveAiRateLimits(input.model, env);
  const { data, error } = await createServiceSupabaseClient().rpc("consume_ai_rate_limit", {
    p_org_id: input.orgId ?? "public",
    p_model: input.model.toLowerCase(),
    p_minute_key: minuteKeyFor(now),
    p_day_key: dayKeyFor(now),
    p_estimated_tokens: input.estimatedTokens,
    p_rpm: limits.rpm,
    p_rpd: limits.rpd,
    p_tpm: limits.tpm
  });

  if (error) {
    if (shouldFallbackFromSupabaseError(error.message)) {
      assertAiRateLimitAvailable(input);
      return;
    }
    throw new Error(`AI shared rate limit failed: ${error.message}`);
  }
  if (data !== true) throw new Error(`AI free-tier shared rate limit reached for ${input.model}`);
}
