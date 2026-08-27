import {
  AiProviderError,
  classifyProviderError,
  emptyProviderResponseError,
  providerHttpError,
  type AiProviderError as AiProviderErrorType
} from "./errors.ts";
import { raceWithBudget } from "./budget.ts";
import type {
  JsonSchema,
  ProviderAdapter,
  ProviderCallOptions,
  RuntimeProviderName,
  RuntimeRequest,
  StructuredOutputSpec,
} from "./types.ts";

function promptFor(request: RuntimeRequest) {
  return `${request.context}\n\nQuestion: ${request.question}`;
}

function positiveAttempts() {
  const attempts = Number(process.env.AI_RETRY_ATTEMPTS ?? 3);
  return Number.isFinite(attempts) ? Math.max(1, Math.floor(attempts)) : 3;
}

function retryDelayMs(attempt: number) {
  return Math.min(2_000, 150 * 2 ** attempt);
}

async function waitForRetry(ms: number, options: ProviderCallOptions) {
  if (options.signal.aborted) throw new Error("aborted");
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      options.signal.removeEventListener("abort", onAbort);
      resolve();
    }, Math.min(ms, Math.max(0, options.budget.remainingMs())));
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    options.signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function postJson(
  provider: RuntimeProviderName,
  url: string,
  body: object,
  options: ProviderCallOptions,
  headers: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await raceWithBudget(
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: options.signal
      }),
      options.budget,
      provider
    );
  } catch (error) {
    if (error instanceof Error && error.message === "aborted") {
      throw classifyProviderError(error, {
        provider,
        deadlineAt: options.budget.deadlineAt,
        signal: options.signal
      });
    }
    throw classifyProviderError(error, {
      provider,
      deadlineAt: options.budget.deadlineAt,
      signal: options.signal
    });
  }
  if (!response.ok) throw providerHttpError(provider, response.status);
  try {
    const payload = (await raceWithBudget(response.json() as Promise<unknown>, options.budget, provider)) as unknown;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      throw new SyntaxError("provider response was not an object");
    }
    return payload as Record<string, unknown>;
  } catch (error) {
    throw classifyProviderError(error, {
      provider,
      deadlineAt: options.budget.deadlineAt,
      signal: options.signal
    });
  }
}

async function withRetries<T>(
  provider: RuntimeProviderName,
  operation: () => Promise<T>,
  options: ProviderCallOptions
) {
  let lastError: AiProviderErrorType | undefined;
  for (let attempt = 0; attempt < positiveAttempts(); attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const classified = classifyProviderError(error, {
        provider,
        deadlineAt: options.budget.deadlineAt,
        signal: options.signal
      });
      lastError = classified;
      if (!classified.retryable || attempt === positiveAttempts() - 1) throw classified;
      await waitForRetry(retryDelayMs(attempt), options);
    }
  }
  throw lastError ?? classifyProviderError(new Error("provider operation failed"), { provider });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function recordValue(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function marker(value: unknown) {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().length > 0;
  return recordValue(value) !== undefined;
}

function hardFailureMarker(value: unknown) {
  const normalized = stringValue(value).trim().toLowerCase();
  return normalized.length > 0 && /(safety|block|prohibit|refus|reject|incomplete|cancel|failed|tool[_-]?use|pause[_-]?turn|content[_-]?filter|recitation|spii)/.test(normalized);
}

function requireProviderText(provider: RuntimeProviderName, text: string, reason = "empty output") {
  if (!text.trim()) throw emptyProviderResponseError(provider, reason);
  return text;
}

function extractGeminiText(payload: Record<string, unknown>) {
  const promptFeedback = recordValue(payload.promptFeedback);
  if (marker(promptFeedback?.blockReason) || marker(promptFeedback?.blockReasonMessage) || payload.blocked === true || payload.safetyBlocked === true) {
    throw emptyProviderResponseError("gemini", "safety-blocked output");
  }
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = recordValue(candidates[0]);
  const finishReason = stringValue(first?.finishReason).trim().toUpperCase();
  if (finishReason && finishReason !== "STOP") throw emptyProviderResponseError("gemini", "blocked or incomplete output");
  const ratings = Array.isArray(first?.safetyRatings) ? first.safetyRatings : [];
  if (ratings.some((rating) => recordValue(rating)?.blocked === true)) {
    throw emptyProviderResponseError("gemini", "safety-blocked output");
  }
  const content = recordValue(first?.content);
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  return requireProviderText("gemini", parts.map((part) => stringValue(recordValue(part)?.text)).join(""));
}

function extractOpenAiText(payload: Record<string, unknown>) {
  const status = stringValue(payload.status).trim().toLowerCase();
  if (hardFailureMarker(status)) throw emptyProviderResponseError("openai", "refused or incomplete output");
  if (marker(payload.refusal) || marker(payload.incomplete_details)) {
    throw emptyProviderResponseError("openai", "refused or incomplete output");
  }
  const output = Array.isArray(payload.output) ? payload.output : [];
  const text = output
    .flatMap((item) => {
      const record = recordValue(item);
      if (hardFailureMarker(record?.type) || hardFailureMarker(record?.status) || marker(record?.refusal) || marker(record?.incomplete_details)) {
        throw emptyProviderResponseError("openai", "refused or incomplete output");
      }
      const content = Array.isArray(record?.content) ? record.content : [];
      return content.map((part) => {
        const partRecord = recordValue(part);
        if (hardFailureMarker(partRecord?.type) || hardFailureMarker(partRecord?.status) || marker(partRecord?.refusal) || marker(partRecord?.incomplete_details)) {
          throw emptyProviderResponseError("openai", "refused or incomplete output");
        }
        return stringValue(partRecord?.text);
      });
    })
    .join("");
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  return requireProviderText("openai", text);
}

function extractClaudeText(payload: Record<string, unknown>) {
  const stopReason = stringValue(payload.stop_reason).trim().toLowerCase();
  if (stopReason && stopReason !== "end_turn" && stopReason !== "stop_sequence") {
    throw emptyProviderResponseError("claude", "refused or incomplete output");
  }
  const content = Array.isArray(payload.content) ? payload.content : [];
  const text = content.map((item) => {
    const record = recordValue(item);
    if (hardFailureMarker(record?.type) || marker(record?.refusal)) {
      throw emptyProviderResponseError("claude", "refused or incomplete output");
    }
    return stringValue(record?.text);
  }).join("\n");
  return requireProviderText("claude", text);
}

function structuredBody(schema: JsonSchema, provider: RuntimeProviderName, name: string) {
  if (provider === "gemini") {
    return {
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: schema
      }
    };
  }
  if (provider === "openai") {
    return {
      text: {
        format: {
          type: "json_schema",
          name,
          strict: true,
          schema
        }
      }
    };
  }
  return {
    output_config: {
      format: {
        type: "json_schema",
        schema: sanitizeAnthropicJsonSchema(schema)
      }
    }
  };
}

/**
 * Anthropic's grammar compiler intentionally supports a smaller subset of
 * JSON Schema than the application validators.  Keep the full schema on the
 * StructuredOutputSpec for local validation, but send only the structural
 * part that Anthropic accepts.  This mirrors the SDK transformation contract
 * without mutating the caller's schema.
 */
const anthropicUnsupportedKeywords = new Set([
  "$schema",
  "$id",
  "$anchor",
  "$comment",
  "default",
  "deprecated",
  "examples",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "maxItems",
  "maxLength",
  "maxProperties",
  "maximum",
  "minItems",
  "minLength",
  "minProperties",
  "minimum",
  "multipleOf",
  "pattern",
  "readOnly",
  "uniqueItems",
  "writeOnly"
]);

function sanitizeAnthropicSchemaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAnthropicSchemaValue);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) {
    if (anthropicUnsupportedKeywords.has(key)) continue;
    if (key === "properties" && child && typeof child === "object" && !Array.isArray(child)) {
      const properties: Record<string, unknown> = {};
      for (const [propertyName, propertySchema] of Object.entries(child as Record<string, unknown>)) {
        properties[propertyName] = sanitizeAnthropicSchemaValue(propertySchema);
      }
      result[key] = properties;
      continue;
    }
    result[key] = sanitizeAnthropicSchemaValue(child);
  }

  // Anthropic's structured-output grammar only permits closed objects.  Keep
  // this remote-only rewrite even when the caller's local schema was open;
  // the original schema remains available for local validation.
  if (source.type === "object") result.additionalProperties = false;
  return result;
}

export function sanitizeAnthropicJsonSchema(schema: JsonSchema): JsonSchema {
  return sanitizeAnthropicSchemaValue(schema) as JsonSchema;
}

function requiredApiKey(provider: RuntimeProviderName) {
  if (provider === "gemini") {
    const key = process.env.AI_API_KEY;
    if (!key) throw new AiProviderError({ kind: "auth", provider, message: "AI_API_KEY is required when AI_PROVIDER=gemini", retryable: false });
    return key;
  }
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new AiProviderError({ kind: "auth", provider, message: "OPENAI_API_KEY is required for openai ensemble provider", retryable: false });
    return key;
  }
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new AiProviderError({ kind: "auth", provider, message: "CLAUDE_API_KEY is required for claude ensemble provider", retryable: false });
  return key;
}

export function resolveProviderModel(provider: RuntimeProviderName) {
  if (provider === "gemini" || provider === "mock") return process.env.AI_MODEL ?? "gemini-2.5-flash";
  if (provider === "openai") return process.env.OPENAI_MODEL ?? "gpt-5-mini";
  return process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
}

function createMockAdapter(): ProviderAdapter {
  const model = resolveProviderModel("mock");
  return {
    name: "mock",
    model,
    async generate(request) {
      return {
        answer: `Odim found reality-layer evidence for: ${request.question}. The local deterministic provider returns source-backed reasoning until Gemini credentials are configured.`,
        model,
        confidence: 0.72,
        sources: ["local:ontology", "local:audit_log"],
        provider: "mock"
      };
    },
    async generateStructured(_request, spec) {
      const value = spec.name === "odim_planner"
        ? {
            need_retrieval: true,
            source_plan: ["munin", "odim_cache"],
            needs_reality_gapfill: false,
            needs_narrative_capture: false,
            confidence_without_retrieval: 0.62,
            uses_past_opinion: false
          }
        : { rubric_scores: [0.8, 0.8, 0.9, 0.7, 0.8], overall_score: 0.8, flags: [] };
      return { text: JSON.stringify(value), model, confidence: 0.72, sources: ["local:structured"] };
    }
  };
}

function createGeminiAdapter(): ProviderAdapter {
  const provider: RuntimeProviderName = "gemini";
  const model = resolveProviderModel(provider);
  return {
    name: provider,
    model,
    async generate(request, options) {
      const apiKey = requiredApiKey(provider);
      const body = { contents: [{ parts: [{ text: promptFor(request) }] }] };
      const payload = await withRetries(
        provider,
        () => postJson(provider, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, body, options, { "x-goog-api-key": apiKey }),
        options
      );
      return { answer: extractGeminiText(payload), model, confidence: 0.5, sources: ["gemini:generateContent"], provider };
    },
    async generateStructured(request, spec, options) {
      const apiKey = requiredApiKey(provider);
      const body = {
        contents: [{ parts: [{ text: promptFor(request) }] }],
        generationConfig: structuredBody(spec.jsonSchema, provider, spec.name).generationConfig
      };
      const payload = await withRetries(
        provider,
        () => postJson(provider, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, body, options, { "x-goog-api-key": apiKey }),
        options
      );
      return { text: extractGeminiText(payload), model, confidence: 0.5, sources: ["gemini:structured"] };
    }
  };
}

function createOpenAiAdapter(): ProviderAdapter {
  const provider: RuntimeProviderName = "openai";
  const model = resolveProviderModel(provider);
  return {
    name: provider,
    model,
    async generate(request, options) {
      const apiKey = requiredApiKey(provider);
      const payload = await withRetries(
        provider,
        () =>
          postJson(
            provider,
            process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/responses",
            { model, input: promptFor(request) },
            options,
            { authorization: `Bearer ${apiKey}` }
          ),
        options
      );
      return { answer: extractOpenAiText(payload), model, confidence: 0.52, sources: ["openai:responses"], provider };
    },
    async generateStructured(request, spec, options) {
      const apiKey = requiredApiKey(provider);
      const structured = structuredBody(spec.jsonSchema, provider, spec.name);
      if (!("text" in structured) || !structured.text) throw new AiProviderError({ kind: "invalid_request", provider, message: "OpenAI structured output configuration is unavailable", retryable: false });
      const format = structured.text.format;
      const payload = await withRetries(
        provider,
        () =>
          postJson(
            provider,
            process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/responses",
            { model, input: promptFor(request), text: { format } },
            options,
            { authorization: `Bearer ${apiKey}` }
          ),
        options
      );
      return { text: extractOpenAiText(payload), model, confidence: 0.52, sources: ["openai:structured"] };
    }
  };
}

function createClaudeAdapter(): ProviderAdapter {
  const provider: RuntimeProviderName = "claude";
  const model = resolveProviderModel(provider);
  return {
    name: provider,
    model,
    async generate(request, options) {
      const apiKey = requiredApiKey(provider);
      const payload = await withRetries(
        provider,
        () =>
          postJson(
            provider,
            process.env.CLAUDE_BASE_URL ?? "https://api.anthropic.com/v1/messages",
            { model, max_tokens: 800, messages: [{ role: "user", content: promptFor(request) }] },
            options,
            { "anthropic-version": "2023-06-01", "x-api-key": apiKey }
          ),
        options
      );
      return { answer: extractClaudeText(payload), model, confidence: 0.52, sources: ["claude:messages"], provider };
    },
    async generateStructured(request, spec, options) {
      const apiKey = requiredApiKey(provider);
      const format = structuredBody(spec.jsonSchema, provider, spec.name).output_config;
      const payload = await withRetries(
        provider,
        () =>
          postJson(
            provider,
            process.env.CLAUDE_BASE_URL ?? "https://api.anthropic.com/v1/messages",
            {
              model,
              max_tokens: 800,
              messages: [{ role: "user", content: promptFor(request) }],
              output_config: format
            },
            options,
            { "anthropic-version": "2023-06-01", "x-api-key": apiKey }
          ),
        options
      );
      return { text: extractClaudeText(payload), model, confidence: 0.52, sources: ["claude:structured"] };
    }
  };
}

export function createProviderAdapter(provider: RuntimeProviderName): ProviderAdapter {
  if (provider === "mock") return createMockAdapter();
  if (provider === "gemini") return createGeminiAdapter();
  if (provider === "openai") return createOpenAiAdapter();
  return createClaudeAdapter();
}

export type ProviderAdapterOverrides = Partial<Record<RuntimeProviderName, ProviderAdapter>>;

export function resolveProviderAdapter(provider: RuntimeProviderName, overrides?: ProviderAdapterOverrides) {
  return overrides?.[provider] ?? createProviderAdapter(provider);
}
