import {
  AiProviderError,
  assertBudgetAvailable,
  createRequestBudget,
  isAiProviderError,
  type AiRuntime,
  type RequestBudget,
  type RuntimeCallOptions,
  type RuntimeProviderName
} from "./runtime/index.ts";
import { generateAnswerWithRuntime, type GenerateRequest, type GenerateResponse } from "./provider.ts";

export type EnsembleProviderName = "gemini" | "claude" | "openai";

export type EnsembleConfig = {
  providers: Array<{
    name: EnsembleProviderName;
    weight: number;
    timeout: number;
    fallback?: boolean;
  }>;
  strategy: "primary-fallback" | "fan-out-consensus" | "best-of-n";
};

export type EnsembleGenerateOptions = RuntimeCallOptions & {
  runtime?: AiRuntime;
  config?: EnsembleConfig;
};

function parseProviders() {
  const configured = process.env.AI_PROVIDERS;
  const names = (configured === undefined || configured.trim() === "" ? process.env.AI_PROVIDER ?? "mock" : configured)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return names.length ? names : ["mock"];
}

function parseWeights() {
  const weights = new Map<string, number>();
  const configured = process.env.AI_PROVIDER_WEIGHTS ?? "";
  for (const item of configured.split(",")) {
    if (!item.trim()) continue;
    const parts = item.split(/[:=]/);
    if (parts.length !== 2) throw ensembleConfigError("AI_PROVIDER_WEIGHTS contains an invalid entry");
    const [rawName, rawWeight] = parts.map((part) => part.trim().toLowerCase());
    const weight = Number(rawWeight);
    if (!rawName || !Number.isFinite(weight) || weight < 0) {
      throw ensembleConfigError("AI_PROVIDER_WEIGHTS contains an invalid entry");
    }
    if (weights.has(rawName)) throw ensembleConfigError(`AI_PROVIDER_WEIGHTS contains duplicate provider: ${rawName}`);
    weights.set(rawName, weight);
  }
  return weights;
}

function positiveTimeout() {
  const configured = process.env.AI_PROVIDER_TIMEOUT_MS;
  if (configured === undefined || configured.trim() === "") return 30_000;
  const value = Number(configured);
  if (!Number.isFinite(value) || value <= 0) throw ensembleConfigError("AI_PROVIDER_TIMEOUT_MS must be a positive number");
  return value;
}

const allowedProviderNames = new Set<EnsembleProviderName>(["gemini", "claude", "openai"]);
const allowedStrategies = new Set<EnsembleConfig["strategy"]>(["primary-fallback", "fan-out-consensus", "best-of-n"]);

function ensembleConfigError(message: string): AiProviderError {
  return new AiProviderError({ kind: "invalid_request", provider: "ensemble", message, retryable: false });
}

function validateEnsembleConfig(config: EnsembleConfig, allowEmpty: boolean): EnsembleConfig {
  if (!config || typeof config !== "object" || !Array.isArray(config.providers)) {
    throw ensembleConfigError("AI ensemble configuration must include providers");
  }
  if (!allowedStrategies.has(config.strategy)) throw ensembleConfigError(`Unsupported AI ensemble strategy: ${String(config.strategy)}`);
  if (!allowEmpty && config.providers.length === 0) throw ensembleConfigError("AI ensemble configuration must include at least one provider");

  const seen = new Set<string>();
  const providers = config.providers.map((provider) => {
    if (!provider || !allowedProviderNames.has(provider.name)) {
      throw ensembleConfigError(`Unsupported AI ensemble provider: ${String(provider?.name)}`);
    }
    if (seen.has(provider.name)) throw ensembleConfigError(`AI ensemble configuration contains duplicate provider: ${provider.name}`);
    seen.add(provider.name);
    if (!Number.isFinite(provider.weight) || provider.weight < 0) {
      throw ensembleConfigError(`AI ensemble provider weight must be non-negative: ${provider.name}`);
    }
    if (!Number.isFinite(provider.timeout) || provider.timeout <= 0) {
      throw ensembleConfigError(`AI ensemble provider timeout must be positive: ${provider.name}`);
    }
    if (provider.fallback !== undefined && typeof provider.fallback !== "boolean") {
      throw ensembleConfigError(`AI ensemble provider fallback must be boolean: ${provider.name}`);
    }
    return { ...provider };
  });
    return { providers, strategy: config.strategy };
}

export function getEnsembleConfig(): EnsembleConfig {
  const configured = process.env.AI_PROVIDERS;
  const rawNames = parseProviders();
  const weights = parseWeights();
  const timeout = positiveTimeout();
  // `mock` is the deliberate local default and means no ensemble providers;
  // every other configured name must be recognized instead of being silently
  // discarded (which could route a paid request to an unintended provider).
  if (rawNames.length === 1 && rawNames[0] === "mock" && (configured === undefined || configured.trim() === "")) {
    if (weights.size) {
      throw ensembleConfigError("Weight configured while ensemble providers are disabled");
    }
    return { providers: [], strategy: resolveStrategy() };
  }
  const invalid = rawNames.filter((name) => !allowedProviderNames.has(name as EnsembleProviderName));
  if (invalid.length) throw ensembleConfigError(`Unsupported AI ensemble provider: ${invalid.join(", ")}`);
  if (new Set(rawNames).size !== rawNames.length) throw ensembleConfigError("AI ensemble configuration contains duplicate providers");
  const names = rawNames as EnsembleProviderName[];
  for (const name of weights.keys()) {
    if (!names.includes(name as EnsembleProviderName)) throw ensembleConfigError(`Weight configured for inactive provider: ${name}`);
  }
  return validateEnsembleConfig({
    providers: names.map((name, index) => ({
      name,
      weight: weights.get(name) ?? (index === 0 ? 1 : 0.75),
      timeout,
      fallback: index > 0
    })),
    strategy: resolveStrategy()
  }, false);
}

function resolveStrategy(): EnsembleConfig["strategy"] {
  const configured = process.env.AI_ENSEMBLE_STRATEGY;
  if (configured === undefined || configured.trim() === "") return "primary-fallback";
  if (!allowedStrategies.has(configured as EnsembleConfig["strategy"])) {
    throw ensembleConfigError(`Unsupported AI ensemble strategy: ${configured}`);
  }
  return configured as EnsembleConfig["strategy"];
}

function providerErrorMeta(error: unknown) {
  if (isAiProviderError(error)) return { provider: error.provider, kind: error.kind };
  return { provider: "unknown", kind: "unknown" as const };
}

async function generateWithProvider(
  name: EnsembleProviderName,
  request: GenerateRequest,
  timeout: number,
  budget: RequestBudget,
  runtime?: AiRuntime
) {
  const options = {
    provider: name as RuntimeProviderName,
    budget,
    providerTimeoutMs: timeout
  } as const;
  return generateAnswerWithRuntime(request, runtime ? { ...options, runtime } : options);
}

type WeightedResponse = GenerateResponse & { provider: EnsembleProviderName; weight: number };

export function pickConsensus(responses: WeightedResponse[]) {
  const maxWeight = Math.max(1, ...responses.map((response) => response.weight));
  const ranked = responses
    .map((response) => ({
      response,
      score:
        response.confidence * 0.65 +
        (Math.max(0, response.weight) / maxWeight) * 0.25 +
        Math.min(0.1, response.answer.split(/\s+/).filter(Boolean).length / 1_000)
    }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.response ?? responses[0];
}

function requestTimeout(config: EnsembleConfig, options: EnsembleGenerateOptions) {
  if (options.timeoutMs !== undefined) return options.timeoutMs;
  const configured = Number(process.env.AI_REQUEST_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return Math.max(...config.providers.map((provider) => provider.timeout), 30_000);
}

function withEnsembleMetadata(response: GenerateResponse, contributors: string[], disagreement: boolean, extra: Partial<GenerateResponse> = {}) {
  return { ...response, contributors, disagreement, ...extra };
}

async function runEnsemble(request: GenerateRequest, config: EnsembleConfig, options: EnsembleGenerateOptions) {
  const runtime = options.runtime;
  const ownBudget = options.budget ? undefined : createRequestBudget({
    signal: options.signal,
    deadlineAt: options.deadlineAt,
    timeoutMs: requestTimeout(config, options)
  });
  const budget = options.budget ?? ownBudget;
  if (!budget) throw new Error("AI ensemble could not create a request budget");

  try {
    assertBudgetAvailable(budget, "ensemble");
    if (config.providers.length <= 1) {
      const single = config.providers[0];
      if (!single) {
        const callOptions = { ...options, budget };
        return runtime ? generateAnswerWithRuntime(request, { ...callOptions, runtime }) : generateAnswerWithRuntime(request, callOptions);
      }
      const response = await generateWithProvider(single.name, request, single.timeout, budget, runtime);
      return withEnsembleMetadata(response, [single.name], false);
    }

    if (config.strategy === "primary-fallback") {
      const [primary, ...fallbacks] = config.providers;
      let primaryError: unknown;
      try {
        const response = await generateWithProvider(primary.name, request, primary.timeout, budget, runtime);
        return withEnsembleMetadata(response, [primary.name], false);
      } catch (error) {
        primaryError = error;
      }

      // A caller cancellation/deadline is not a provider failure to recover
      // from. Do not spend more budget (or make another paid call) after it.
      if (budget.signal.aborted || budget.remainingMs() <= 0) throw primaryError;

      for (const provider of fallbacks) {
        try {
          const response = await generateWithProvider(provider.name, request, provider.timeout, budget, runtime);
          const meta = providerErrorMeta(primaryError);
          return withEnsembleMetadata(response, [provider.name], false, {
            degraded: true,
            fallback: true,
            fallbackReason: `${meta.provider}:${meta.kind}`,
            errorKind: meta.kind
          });
        } catch {
          // Continue while the shared request budget still permits a fallback.
          if (budget.signal.aborted || budget.remainingMs() <= 0) break;
        }
      }
      throw primaryError;
    }

    const settled = await Promise.allSettled(
      config.providers.map(async (provider) => ({
        provider: provider.name,
        weight: provider.weight,
        response: await generateWithProvider(provider.name, request, provider.timeout, budget, runtime)
      }))
    );
    // A partial fast result is not safe to return after the caller's deadline
    // or abort has fired; every provider shared this same request budget.
    assertBudgetAvailable(budget, "ensemble");
    const successes = settled
      .filter((result): result is PromiseFulfilledResult<{ provider: EnsembleProviderName; weight: number; response: GenerateResponse }> => result.status === "fulfilled")
      .map((result) => ({ ...result.value.response, provider: result.value.provider, weight: result.value.weight }))
      .filter((response) => response.answer.trim());
    const failures = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (!successes.length) throw failures[0]?.reason ?? new Error("All AI ensemble providers failed");

    const winner = pickConsensus(successes);
    const disagreement = successes.some(
      (response) => response.provider !== winner.provider && response.answer.slice(0, 120) !== winner.answer.slice(0, 120)
    );
    const firstFailure = failures[0] ? providerErrorMeta(failures[0].reason) : undefined;
    return withEnsembleMetadata(winner, successes.map((response) => response.provider), disagreement, failures.length
      ? {
          degraded: true,
          fallback: true,
          fallbackReason: "partial_provider_failure",
          errorKind: firstFailure?.kind
        }
      : {});
  } finally {
    if (ownBudget) ownBudget.dispose();
  }
}

export async function ensembleGenerateWithConfig(request: GenerateRequest, config: EnsembleConfig, options: EnsembleGenerateOptions = {}) {
  return runEnsemble(request, validateEnsembleConfig(config, false), options);
}

export async function ensembleGenerate(request: GenerateRequest, options: EnsembleGenerateOptions = {}) {
  const config = options.config ? validateEnsembleConfig(options.config, false) : getEnsembleConfig();
  return runEnsemble(request, config, options);
}
