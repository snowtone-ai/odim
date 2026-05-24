import { assertAiRateLimitAvailable, estimateTokens } from "./rate-limit.ts";

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
};

function retryDelayMs(attempt: number) {
  return Math.min(4000, 250 * 2 ** attempt);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateAnswer(request: GenerateRequest): Promise<GenerateResponse> {
  const provider = process.env.AI_PROVIDER ?? "mock";
  const model = process.env.AI_MODEL ?? "gemini-2.5-flash";

  if (provider === "mock") {
    return {
      answer: `Odim found reality-layer evidence for: ${request.question}. The local deterministic provider returns source-backed reasoning until Gemini credentials are configured.`,
      model,
      confidence: 0.72,
      sources: ["local:ontology", "local:audit_log"]
    };
  }

  if (provider !== "gemini") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is required when AI_PROVIDER=gemini");
  const attempts = Math.max(1, Number(process.env.AI_RETRY_ATTEMPTS ?? 3));
  assertAiRateLimitAvailable({
    model,
    orgId: request.orgId,
    estimatedTokens: estimateTokens(`${request.context}\n\nQuestion: ${request.question}`)
  });

  let response: Response | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${request.context}\n\nQuestion: ${request.question}` }] }]
      })
    });

    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) break;
    await sleep(retryDelayMs(attempt));
  }

  if (!response?.ok) throw new Error(`Gemini request failed: ${response?.status ?? "no response"}`);
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  return {
    answer: text,
    model,
    confidence: 0.5,
    sources: ["gemini:generateContent"]
  };
}
