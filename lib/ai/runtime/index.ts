import { assertBudgetAvailable, createRequestBudget, raceWithBudget, type RequestBudget, type RequestBudgetOptions } from "./budget.ts";
import { runtimeCache, buildRuntimeCacheKey, type TtlSingleflightCache } from "./cache.ts";
import { CircuitBreakerRegistry, runtimeCircuitBreakers } from "./circuit-breaker.ts";
import { InFlightLimiter, runtimeInFlightLimiter } from "./concurrency.ts";
import { AiProviderError, classifyProviderError, emptyProviderResponseError } from "./errors.ts";
import { parseStructuredJson } from "./schemas.ts";
import { resolveProviderAdapter, type ProviderAdapterOverrides } from "./providers.ts";
import type { ProviderAdapter, RuntimeProviderName, RuntimeRequest, RuntimeResponse, StructuredOutputSpec, StructuredTransportResponse } from "./types.ts";

export * from "./budget.ts";
export * from "./cache.ts";
export * from "./circuit-breaker.ts";
export * from "./concurrency.ts";
export * from "./errors.ts";
export * from "./providers.ts";
export * from "./schemas.ts";
export * from "./tools.ts";
export * from "./types.ts";

export type RuntimeCallOptions = {
  signal?: AbortSignal;
  deadlineAt?: number;
  timeoutMs?: number;
  providerTimeoutMs?: number;
  cacheTtlMs?: number;
  budget?: RequestBudget;
  beforeProviderCall?: () => void | Promise<void>;
};

export type RuntimeOptions = {
  adapters?: ProviderAdapterOverrides;
  cache?: TtlSingleflightCache;
  circuitBreakers?: CircuitBreakerRegistry;
  inFlightLimiter?: InFlightLimiter;
  cacheTtlMs?: number;
};

export type StructuredRuntimeResult<T> = {
  value: T;
  provider: RuntimeProviderName;
  model: string;
  cacheHit: boolean;
  confidence?: number;
  sources?: string[];
};

function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function providerKey(orgId: string | undefined, provider: RuntimeProviderName, model: string) {
  return `${orgId?.trim() || "public"}:${provider}:${model}`;
}

function classify(error: unknown, provider: RuntimeProviderName, budget: RequestBudget) {
  return classifyProviderError(error, { provider, deadlineAt: budget.deadlineAt, signal: budget.signal });
}

function assertRuntimeResponse(response: unknown, provider: RuntimeProviderName): RuntimeResponse {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw emptyProviderResponseError(provider, "missing output");
  }
  const value = response as Partial<RuntimeResponse>;
  if (typeof value.answer !== "string" || !value.answer.trim()) {
    throw emptyProviderResponseError(provider);
  }
  return value as RuntimeResponse;
}

function workTimeoutMs(options: RuntimeCallOptions) {
  const configured = Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? process.env.AI_REQUEST_TIMEOUT_MS ?? 8_000);
  const defaultProviderTimeout = Number.isFinite(configured) && configured > 0 ? configured : 8_000;
  return Math.max(defaultProviderTimeout, options.providerTimeoutMs ?? 0);
}

export class AiRuntime {
  private readonly adapters?: ProviderAdapterOverrides;
  private readonly cache: TtlSingleflightCache;
  private readonly circuitBreakers: CircuitBreakerRegistry;
  private readonly inFlightLimiter: InFlightLimiter;
  private readonly defaultCacheTtlMs: number;

  constructor(options: RuntimeOptions = {}) {
    this.adapters = options.adapters;
    this.cache = options.cache ?? runtimeCache;
    this.circuitBreakers = options.circuitBreakers ?? runtimeCircuitBreakers;
    this.inFlightLimiter = options.inFlightLimiter ?? runtimeInFlightLimiter;
    this.defaultCacheTtlMs = options.cacheTtlMs ?? positiveEnv("AI_CACHE_TTL_MS", 30_000);
  }

  private async executeProviderCall<T>(input: {
    request: RuntimeRequest;
    provider: RuntimeProviderName;
    model: string;
    budget: RequestBudget;
    beforeProviderCall?: () => void | Promise<void>;
    operation: () => Promise<T>;
  }): Promise<T> {
    const release = await this.inFlightLimiter.acquire(input.request.orgId, input.budget, input.provider);
    try {
      return await this.circuitBreakers.execute(
        providerKey(input.request.orgId, input.provider, input.model),
        input.provider,
        async () => {
          assertBudgetAvailable(input.budget, input.provider);
          await input.beforeProviderCall?.();
          assertBudgetAvailable(input.budget, input.provider);
          return await raceWithBudget(input.operation(), input.budget, input.provider);
        }
      );
    } finally {
      release();
    }
  }

  async generate(request: RuntimeRequest, provider: RuntimeProviderName, options: RuntimeCallOptions = {}): Promise<RuntimeResponse & { cacheHit: boolean }> {
    const adapter = resolveProviderAdapter(provider, this.adapters);
    const ownBudget = options.budget ? undefined : createRequestBudget(options as RequestBudgetOptions);
    const parentBudget = options.budget ?? ownBudget;
    if (!parentBudget) throw new Error("AI runtime could not create a request budget");
    const childBudget = options.providerTimeoutMs ? parentBudget.child(options.providerTimeoutMs) : undefined;
    const budget = childBudget ?? parentBudget;
    const key = buildRuntimeCacheKey({
      orgId: request.orgId,
      provider,
      model: adapter.model,
      schemaVersion: "answer-v3",
      question: request.question,
      context: request.context
    });
    const ttl = options.cacheTtlMs ?? this.defaultCacheTtlMs;
    try {
      assertBudgetAvailable(budget, provider);
      const result = await this.cache.getOrCreate(key, async (workBudget) => {
          const providerBudget = options.providerTimeoutMs ? workBudget.child(options.providerTimeoutMs) : workBudget;
          try {
            const response = await this.executeProviderCall({
              request,
              provider,
              model: adapter.model,
              budget: providerBudget,
              beforeProviderCall: options.beforeProviderCall,
              operation: () => adapter.generate(request, { signal: providerBudget.signal, budget: providerBudget })
            });
            return { ...assertRuntimeResponse(response, provider), provider };
          } finally {
            if (providerBudget !== workBudget) providerBudget.dispose();
          }
        }, ttl, { workTimeoutMs: workTimeoutMs(options), waiterBudget: budget, provider });
      return { ...result.value, cacheHit: result.cacheHit };
    } catch (error) {
      throw classify(error, provider, budget);
    } finally {
      if (childBudget) childBudget.dispose();
      if (ownBudget) ownBudget.dispose();
    }
  }

  async generateStructured<T>(
    request: RuntimeRequest,
    provider: RuntimeProviderName,
    spec: StructuredOutputSpec<T>,
    options: RuntimeCallOptions = {}
  ): Promise<StructuredRuntimeResult<T>> {
    const adapter = resolveProviderAdapter(provider, this.adapters);
    const ownBudget = options.budget ? undefined : createRequestBudget(options as RequestBudgetOptions);
    const parentBudget = options.budget ?? ownBudget;
    if (!parentBudget) throw new Error("AI runtime could not create a request budget");
    const childBudget = options.providerTimeoutMs ? parentBudget.child(options.providerTimeoutMs) : undefined;
    const budget = childBudget ?? parentBudget;
    const key = buildRuntimeCacheKey({
      orgId: request.orgId,
      provider,
      model: adapter.model,
      schemaVersion: spec.schemaVersion,
      jsonSchema: spec.jsonSchema,
      question: request.question,
      context: request.context
    });
    const ttl = options.cacheTtlMs ?? this.defaultCacheTtlMs;
    try {
      assertBudgetAvailable(budget, provider);
      const result = await this.cache.getOrCreate(key, async (workBudget) => {
          if (!adapter.generateStructured) {
            throw new AiProviderError({
              kind: "invalid_request",
              provider,
              message: `${provider} adapter does not support structured output`,
              retryable: false
            });
          }
          const providerBudget = options.providerTimeoutMs ? workBudget.child(options.providerTimeoutMs) : workBudget;
          try {
            const transport = await this.executeProviderCall({
              request,
              provider,
              model: adapter.model,
              budget: providerBudget,
              beforeProviderCall: options.beforeProviderCall,
              operation: () => adapter.generateStructured!(request, spec, { signal: providerBudget.signal, budget: providerBudget })
            });
            if (!transport || typeof transport.text !== "string" || !transport.text.trim()) {
              throw emptyProviderResponseError(provider, "empty structured output");
            }
            const value = parseStructuredJson(transport.text, spec, provider);
            return { value, model: transport.model, confidence: transport.confidence, sources: transport.sources };
          } finally {
            if (providerBudget !== workBudget) providerBudget.dispose();
          }
        }, ttl, { workTimeoutMs: workTimeoutMs(options), waiterBudget: budget, provider });
      const value = result.value as { value: T; model: string; confidence?: number; sources?: string[] };
      return {
        value: value.value,
        model: value.model,
        confidence: value.confidence,
        sources: value.sources,
        provider,
        cacheHit: result.cacheHit
      };
    } catch (error) {
      throw classify(error, provider, budget);
    } finally {
      if (childBudget) childBudget.dispose();
      if (ownBudget) ownBudget.dispose();
    }
  }
}

export function createAiRuntime(options: RuntimeOptions = {}) {
  return new AiRuntime(options);
}

export const defaultAiRuntime = new AiRuntime();

export function runtimeProviderNames(): RuntimeProviderName[] {
  return ["mock", "gemini", "openai", "claude"];
}

export type RuntimeStructuredTransport = StructuredTransportResponse;
export type RuntimeProviderAdapter = ProviderAdapter;
