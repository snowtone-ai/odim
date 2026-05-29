import { generateAnswer } from "../ai/provider.ts";
import type { NormalizedSignal } from "./types.ts";

export type SentimentResult = {
  signalId: string;
  sentiment: number;
  magnitude: number;
  entityMentions: string[];
};

const POSITIVE = ["expansion", "approval", "award", "surge", "growth", "record", "investment", "contract"];
const NEGATIVE = ["delay", "probe", "shutdown", "drop", "shortage", "lawsuit", "recall", "investigation"];

const sentimentCache = new Map<string, SentimentResult>();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function heuristicSentiment(textValue: string) {
  const lower = textValue.toLowerCase();
  const positive = POSITIVE.reduce((sum, token) => sum + (lower.includes(token) ? 1 : 0), 0);
  const negative = NEGATIVE.reduce((sum, token) => sum + (lower.includes(token) ? 1 : 0), 0);
  const delta = positive - negative;
  return clamp(delta / 3, -1, 1);
}

export async function quantifyNarrativeSentiment(narrativeSignals: NormalizedSignal[]): Promise<SentimentResult[]> {
  const results: SentimentResult[] = [];

  for (const signal of narrativeSignals) {
    const cached = sentimentCache.get(signal.fingerprint);
    if (cached) {
      results.push(cached);
      continue;
    }

    const title = text(signal.sourceRefs[0]?.title);
    const entityName = text(signal.payload.entityName);
    let sentiment = heuristicSentiment(`${title} ${entityName}`.trim());

    if ((process.env.AI_PROVIDER ?? "mock") === "gemini" && process.env.AI_API_KEY) {
      try {
        const response = await generateAnswer({
          question: "Classify sentiment",
          context: `Return only a number between -1 and 1 for the sentiment of this headline:\n${title}`,
          orgId: signal.orgId ?? undefined
        });
        const parsed = Number(response.answer.match(/-?\d+(\.\d+)?/)?.[0] ?? sentiment);
        if (Number.isFinite(parsed)) sentiment = clamp(parsed, -1, 1);
      } catch {
        // Fall back to deterministic scoring.
      }
    }

    const result = {
      signalId: signal.fingerprint,
      sentiment,
      magnitude: Math.abs(sentiment),
      entityMentions: [entityName].filter(Boolean)
    } satisfies SentimentResult;
    sentimentCache.set(signal.fingerprint, result);
    results.push(result);
  }

  return results;
}

export function computeDivergenceIndex(realityScore: number, narrativeSentiment: number) {
  const realityNormalized = clamp(realityScore / 100, 0, 1);
  const sentimentNormalized = clamp((narrativeSentiment + 1) / 2, 0, 1);
  const denominator = Math.max(0.1, Math.max(realityNormalized, sentimentNormalized));
  return clamp(Math.abs(realityNormalized - sentimentNormalized) / denominator, 0, 1);
}
