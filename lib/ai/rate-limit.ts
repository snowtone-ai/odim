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
