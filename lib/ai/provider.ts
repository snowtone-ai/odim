import { assertAiRateLimitAvailableForRequest, estimateTokens } from "./rate-limit.ts";
import {
  AiProviderError,
  defaultAiRuntime,
  type AiRuntime,
  type RuntimeCallOptions,
  type RuntimeProviderName
} from "./runtime/index.ts";
import { graderSpec, plannerSpec } from "./runtime/schemas.ts";

export type GenerateRequest = {
  question: string;
  context: string;
  orgId?: string;
};

export type GenerateResponse = {
  answer: string;
  model: string;
  confidence: number;
  sources: string[];
  provider?: RuntimeProviderName;
  cacheHit?: boolean;
  degraded?: boolean;
  fallback?: boolean;
  fallbackReason?: string;
  errorKind?: AiProviderError["kind"];
  contributors?: string[];
  disagreement?: boolean;
};

export type StructuredAssessmentResponse = {
  need_retrieval: boolean;
  source_plan: Array<"munin" | "odim_cache" | "reality_gapfill">;
  needs_reality_gapfill: boolean;
  needs_narrative_capture: boolean;
  confidence_without_retrieval: number;
  uses_past_opinion: boolean;
};

export type GraderAssessmentResponse = {
  rubric_scores: number[];
  overall_score: number;
  flags: string[];
};

export type GenerateRuntimeOptions = RuntimeCallOptions & {
  runtime?: AiRuntime;
  provider?: RuntimeProviderName;
};

function providerFromEnv(value = process.env.AI_PROVIDER ?? "mock"): RuntimeProviderName | undefined {
  return ["mock", "gemini", "openai", "claude"].includes(value) ? (value as RuntimeProviderName) : undefined;
}

function deterministicMockAnswer(request: GenerateRequest): GenerateResponse {
  return {
    answer: `Odim found reality-layer evidence for: ${request.question}. The local deterministic provider returns source-backed reasoning until Gemini credentials are configured.`,
    model: process.env.AI_MODEL ?? "gemini-2.5-flash",
    confidence: 0.72,
    sources: ["local:ontology", "local:audit_log"]
  };
}

function requireKnownProvider(value: string): RuntimeProviderName {
  const provider = providerFromEnv(value);
  if (!provider) {
    throw new AiProviderError({
      kind: "invalid_request",
      provider: value,
      message: `Unsupported AI_PROVIDER: ${value}`,
      retryable: false
    });
  }
  return provider;
}

function assertProviderKey(provider: RuntimeProviderName) {
  if (provider === "gemini" && !process.env.AI_API_KEY) {
    throw new AiProviderError({ kind: "auth", provider, message: "AI_API_KEY is required when AI_PROVIDER=gemini", retryable: false });
  }
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new AiProviderError({ kind: "auth", provider, message: "OPENAI_API_KEY is required for openai ensemble provider", retryable: false });
  }
  if (provider === "claude" && !process.env.CLAUDE_API_KEY) {
    throw new AiProviderError({ kind: "auth", provider, message: "CLAUDE_API_KEY is required for claude ensemble provider", retryable: false });
  }
}

async function assertRateLimit(request: GenerateRequest, provider: RuntimeProviderName) {
  if (provider !== "gemini") return;
  try {
    await assertAiRateLimitAvailableForRequest({
      model: process.env.AI_MODEL ?? "gemini-2.5-flash",
      orgId: request.orgId,
      estimatedTokens: estimateTokens(`${request.context}\n\nQuestion: ${request.question}`)
    });
  } catch (error) {
    throw new AiProviderError({
      kind: "rate_limit",
      provider,
      message: error instanceof Error ? error.message : "AI provider rate limit reached",
      retryable: false,
      cause: error
    });
  }
}

export async function generateAnswerWithRuntime(request: GenerateRequest, options: GenerateRuntimeOptions = {}): Promise<GenerateResponse> {
  const provider = options.provider ?? requireKnownProvider(process.env.AI_PROVIDER ?? "mock");
  if (provider === "mock" && !options.runtime) return deterministicMockAnswer(request);
  if (!options.runtime) assertProviderKey(provider);
  const runtime = options.runtime ?? defaultAiRuntime;
  const response = await runtime.generate(request, provider, {
    ...options,
    beforeProviderCall: async () => {
      // Rate admission belongs immediately before the paid provider call. It
      // is deliberately installed even when a transport/runtime is injected;
      // test transports must exercise the same limiter/circuit path as the
      // default adapter rather than creating an unbounded escape hatch.
      await assertRateLimit(request, provider);
      await options.beforeProviderCall?.();
    }
  });
  const result: GenerateResponse = {
    answer: response.answer,
    model: response.model,
    confidence: response.confidence,
    sources: response.sources,
    provider: response.provider
  };
  if (response.cacheHit) result.cacheHit = true;
  return result;
}

export async function generateAnswer(request: GenerateRequest, options?: GenerateRuntimeOptions): Promise<GenerateResponse> {
  return generateAnswerWithRuntime(request, options);
}

function plannerFallback(question: string): StructuredAssessmentResponse {
  const lower = question.toLowerCase();
  return {
    need_retrieval: !/(remember|opinion only|preference)/i.test(question),
    source_plan: lower.includes("filing") || lower.includes("ferc") || lower.includes("sec") ? ["munin", "odim_cache", "reality_gapfill"] : ["munin", "odim_cache"],
    needs_reality_gapfill: /(filing|ferc|sec|puc|official|primary)/i.test(question),
    needs_narrative_capture: /(market|narrative|analyst|sentiment|consensus)/i.test(question),
    confidence_without_retrieval: /(latest|current|filing|ferc|sec)/i.test(question) ? 0.2 : 0.62,
    uses_past_opinion: /(past opinion|previous opinion|opinion|preference|thesis)/i.test(question)
  };
}

function graderFallback(answer: string): GraderAssessmentResponse {
  return answer.includes("I agree")
    ? { rubric_scores: [0.6, 0.1, 0.8, 0.7, 0.6], overall_score: 0.56, flags: ["sycophancy_suspected"] }
    : { rubric_scores: [0.8, 0.8, 0.9, 0.7, 0.8], overall_score: 0.8, flags: [] };
}

function structuredPrompt(request: { question: string; coreMemory: string }) {
  return [
    "Return only JSON for this SelfAssessmentPlan schema:",
    "{ need_retrieval:boolean, source_plan:('munin'|'odim_cache'|'reality_gapfill')[], needs_reality_gapfill:boolean, needs_narrative_capture:boolean, confidence_without_retrieval:number, uses_past_opinion:boolean }",
    "Past opinions are opt-in only. Narrative capture is contrast-only, never evidence.",
    `Core memory:\n${request.coreMemory}`,
    `Question:\n${request.question}`
  ].join("\n\n");
}

function graderPrompt(request: { question: string; answer: string }) {
  return [
    "You are an independent Outcomes Grader. You receive only the question and answer.",
    "Do not infer user history, org context, Munin memory, or opinions.",
    "Return only JSON: { rubric_scores:number[5], overall_score:number, flags:string[] }.",
    "Flags allowed: sycophancy_suspected, narrative_as_evidence, missing_sources, no_uncertainty.",
    "Rubric: primary Reality evidence, not merely agreeing with user, no narrative as evidence, sources provided, uncertainty shown.",
    `Question:\n${request.question}`,
    `Answer:\n${request.answer}`
  ].join("\n\n");
}

export async function generateStructuredAssessment(
  request: { question: string; coreMemory: string; orgId?: string },
  options: GenerateRuntimeOptions = {}
): Promise<StructuredAssessmentResponse> {
  const provider = options.provider ?? requireKnownProvider(process.env.AI_PROVIDER ?? "mock");
  const fallback = plannerFallback(request.question);
  if (provider === "mock" && !options.runtime) return fallback;
  if (!options.runtime) assertProviderKey(provider);
  try {
    const runtime = options.runtime ?? defaultAiRuntime;
    const result = await runtime.generateStructured(
      { question: request.question, context: structuredPrompt(request), orgId: request.orgId },
      provider,
      plannerSpec,
        {
          ...options,
        beforeProviderCall: async () => {
          await assertRateLimit({ question: request.question, context: structuredPrompt(request), orgId: request.orgId }, provider);
          await options.beforeProviderCall?.();
        }
      }
    );
    return result.value;
  } catch (error) {
    if (error instanceof AiProviderError && error.kind === "parse") return fallback;
    throw error;
  }
}

export async function generateGraderAssessment(
  request: { question: string; answer: string; orgId?: string },
  options: GenerateRuntimeOptions = {}
): Promise<GraderAssessmentResponse> {
  const provider = options.provider ?? requireKnownProvider(process.env.AI_PROVIDER ?? "mock");
  const fallback = graderFallback(request.answer);
  if (provider === "mock" && !options.runtime) return fallback;
  if (!options.runtime) assertProviderKey(provider);
  try {
    const runtime = options.runtime ?? defaultAiRuntime;
    const result = await runtime.generateStructured(
      { question: request.question, context: graderPrompt(request), orgId: request.orgId },
      provider,
      graderSpec,
        {
          ...options,
        beforeProviderCall: async () => {
          await assertRateLimit({ question: request.question, context: graderPrompt(request), orgId: request.orgId }, provider);
          await options.beforeProviderCall?.();
        }
      }
    );
    return result.value;
  } catch (error) {
    if (error instanceof AiProviderError && error.kind === "parse") return fallback;
    throw error;
  }
}
