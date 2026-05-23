export type GenerateRequest = {
  question: string;
  context: string;
};

export type GenerateResponse = {
  answer: string;
  model: string;
  confidence: number;
  sources: string[];
};

export async function generateAnswer(request: GenerateRequest): Promise<GenerateResponse> {
  const provider = process.env.AI_PROVIDER ?? "mock";
  const model = process.env.AI_MODEL ?? "gemini-2.5-flash";

  if (provider === "mock") {
    return {
      answer: `Odim found reality-layer evidence for: ${request.question}. The current scaffold returns source-backed mock reasoning until Gemini credentials are configured.`,
      model,
      confidence: 0.72,
      sources: ["mock:ontology", "mock:audit_log"]
    };
  }

  if (provider !== "gemini") {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error("AI_API_KEY is required when AI_PROVIDER=gemini");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${request.context}\n\nQuestion: ${request.question}` }] }]
    })
  });

  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  return {
    answer: text,
    model,
    confidence: 0.5,
    sources: ["gemini:generateContent"]
  };
}
