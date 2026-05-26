"use server";

import { answerHuginnQuestion } from "@/lib/huginn/query";

/** Serialized subset of HuginnResponse safe for client component hydration */
export type ClientHuginnResponse = {
  answer: string;
  confidence: number;
  sources: string[];
  reasoningTrace: Array<{ step: string; summary: string; confidence?: number; sources?: string[] }>;
  munin: { counts: Record<string, number> };
  retrieval_layers_used: string[];
  narrativeContrast: Array<{ title: string }>;
  eval_log_id: string;
  orgId: string;
};

/**
 * Server Action wrapper for Huginn queries.
 * Runs server-side — no API key or auth token required in the browser.
 */
export async function submitHuginnQuestion(
  question: string,
  orgId: string
): Promise<ClientHuginnResponse> {
  const result = await answerHuginnQuestion({ question, orgId });
  return {
    answer: result.answer,
    confidence: result.confidence,
    sources: result.sources,
    reasoningTrace: result.reasoningTrace,
    munin: { counts: result.munin.counts },
    retrieval_layers_used: result.retrieval_layers_used,
    narrativeContrast: result.narrativeContrast,
    eval_log_id: result.eval_log_id,
    orgId: result.orgId
  };
}
