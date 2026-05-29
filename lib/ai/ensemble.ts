import { generateAnswer, type GenerateRequest, type GenerateResponse } from "./provider.ts";

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

function parseProviders() {
  const names = (process.env.AI_PROVIDERS ?? process.env.AI_PROVIDER ?? "mock")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return names.length ? names : ["mock"];
}

export function getEnsembleConfig(): EnsembleConfig {
  const names = parseProviders().filter((name): name is EnsembleProviderName => ["gemini", "claude", "openai"].includes(name));
  return {
    providers: names.map((name, index) => ({
      name,
      weight: index === 0 ? 1 : 0.75,
      timeout: Number(process.env.AI_PROVIDER_TIMEOUT_MS ?? 30_000),
      fallback: index > 0
    })),
    strategy: (process.env.AI_ENSEMBLE_STRATEGY as EnsembleConfig["strategy"]) || "primary-fallback"
  };
}

async function providerFetch(url: string, apiKey: string, headers: Record<string, string>, body: object, timeout: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, ...headers },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithProvider(name: EnsembleProviderName, request: GenerateRequest, timeout: number): Promise<GenerateResponse> {
  if (name === "gemini") return generateAnswer(request);
  if (name === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for openai ensemble provider");
    const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";
    const response = await providerFetch(
      process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/responses",
      apiKey,
      {},
      {
        model,
        input: `${request.context}\n\nQuestion: ${request.question}`
      },
      timeout
    );
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    const payload = (await response.json()) as { output_text?: string };
    return { answer: payload.output_text ?? "", model, confidence: 0.52, sources: ["openai:responses"] };
  }
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY is required for claude ensemble provider");
  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514";
  const response = await providerFetch(
    process.env.CLAUDE_BASE_URL ?? "https://api.anthropic.com/v1/messages",
    apiKey,
    { "anthropic-version": "2023-06-01", "x-api-key": apiKey },
    {
      model,
      max_tokens: 800,
      messages: [{ role: "user", content: `${request.context}\n\nQuestion: ${request.question}` }]
    },
    timeout
  );
  if (!response.ok) throw new Error(`Claude request failed: ${response.status}`);
  const payload = (await response.json()) as { content?: Array<{ text?: string }> };
  return { answer: payload.content?.map((item) => item.text ?? "").join("\n") ?? "", model, confidence: 0.52, sources: ["claude:messages"] };
}

function pickConsensus(responses: Array<GenerateResponse & { provider: EnsembleProviderName }>) {
  const ranked = responses
    .map((response) => ({
      response,
      score:
        response.confidence * 0.7 +
        Math.min(0.3, response.answer.split(/\s+/).filter(Boolean).length / 400)
    }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.response ?? responses[0];
}

export async function ensembleGenerate(request: GenerateRequest) {
  const config = getEnsembleConfig();
  if (config.providers.length <= 1) {
    const single = config.providers[0];
    if (!single) return generateAnswer(request);
    return {
      ...(await generateWithProvider(single.name, request, single.timeout)),
      contributors: [single.name],
      disagreement: false
    };
  }

  if (config.strategy === "primary-fallback") {
    const [primary, ...fallbacks] = config.providers;
    try {
      return {
        ...(await generateWithProvider(primary.name, request, primary.timeout)),
        contributors: [primary.name],
        disagreement: false
      };
    } catch (error) {
      for (const provider of fallbacks) {
        try {
          return {
            ...(await generateWithProvider(provider.name, request, provider.timeout)),
            contributors: [provider.name],
            disagreement: false
          };
        } catch {
          // keep trying fallbacks
        }
      }
      throw error;
    }
  }

  const responses = (
    await Promise.all(
      config.providers.map(async (provider) => {
        const response = await generateWithProvider(provider.name, request, provider.timeout);
        return { ...response, provider: provider.name };
      })
    )
  ).filter((response) => response.answer.trim());

  const winner = pickConsensus(responses);
  const disagreement = responses.some(
    (response) => response.provider !== winner.provider && response.answer.slice(0, 120) !== winner.answer.slice(0, 120)
  );
  return {
    answer: winner.answer,
    model: winner.model,
    confidence: winner.confidence,
    sources: winner.sources,
    contributors: responses.map((response) => response.provider),
    disagreement
  };
}
