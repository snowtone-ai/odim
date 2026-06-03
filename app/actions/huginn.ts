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
  evidenceGraph?: {
    paths: Array<{
      id: string;
      title: string;
      confidence: number;
      citationCoverage: number;
      traceCompleteness: number;
      rationale: string;
      sources: Array<{ sourceId: string; title: string; url: string }>;
    }>;
    metrics: {
      citationCoverage: number;
      traceCompleteness: number;
      averageConfidence: number;
      nodeCount: number;
      edgeCount: number;
      sourceCount: number;
    };
    source: "fallback" | "supabase";
  };
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
  orgId: string,
  webSearch?: boolean
): Promise<ClientHuginnResponse> {
  const result = await answerHuginnQuestion({ question, orgId, webSearch });
  return {
    answer: result.answer,
    confidence: result.confidence,
    sources: result.sources,
    reasoningTrace: result.reasoningTrace,
    munin: { counts: result.munin.counts },
    retrieval_layers_used: result.retrieval_layers_used,
    evidenceGraph: result.evidenceGraph
      ? {
          paths: result.evidenceGraph.paths.map((path) => ({
            id: path.id,
            title: path.title,
            confidence: path.confidence,
            citationCoverage: path.citationCoverage,
            traceCompleteness: path.traceCompleteness,
            rationale: path.rationale,
            sources: path.sources.map((ref) => ({
              sourceId: ref.sourceId,
              title: ref.title,
              url: ref.url
            }))
          })),
          metrics: {
            citationCoverage: result.evidenceGraph.metrics.citationCoverage,
            traceCompleteness: result.evidenceGraph.metrics.traceCompleteness,
            averageConfidence: result.evidenceGraph.metrics.averageConfidence,
            nodeCount: result.evidenceGraph.metrics.nodeCount,
            edgeCount: result.evidenceGraph.metrics.edgeCount,
            sourceCount: result.evidenceGraph.metrics.sourceCount
          },
          source: result.evidenceGraph.source
        }
      : undefined,
    narrativeContrast: result.narrativeContrast,
    eval_log_id: result.eval_log_id,
    orgId: result.orgId
  };
}
