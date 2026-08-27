"use server";

import { cookies } from "next/headers";
import { checkRequestRateLimit } from "@/lib/api/rate-limit";
import { isCommercialProductionEnv } from "@/lib/auth/api-keys";
import { ssoCookieName, verifySsoSession } from "@/lib/auth/sso";
import { answerHuginnQuestion } from "@/lib/huginn/query";
import { createMuninTemporalMemoryReader } from "@/lib/munin/reader";
import type { HuginnClaimCitation, HuginnGrounding, HuginnRunMetadata, HuginnSafeStatus } from "@/lib/huginn/orchestrator/types";

/** Serialized subset of HuginnResponse safe for client component hydration. */
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
  /** Additive v3 metadata; existing consumers may ignore it. */
  run?: HuginnRunMetadata;
  grounding?: HuginnGrounding;
  status?: HuginnSafeStatus;
  citationLedger?: HuginnClaimCitation[];
};

class HuginnActionSecurityError extends Error {
  readonly code: "unauthorized" | "rate_limited";

  constructor(code: "unauthorized" | "rate_limited") {
    super(code);
    this.code = code;
  }
}

function actionAuthRequired() {
  return process.env.AUTH_REQUIRED === "true" || isCommercialProductionEnv();
}

async function resolveActionContext(requestedOrgId: string) {
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(ssoCookieName())?.value;
  } catch {
    // Unit callers and malformed action contexts have no trustworthy session.
    // Local fixture mode may still use the explicit fixture org; protected
    // deployments fail closed below.
    if (actionAuthRequired()) throw new HuginnActionSecurityError("unauthorized");
  }
  let session = null;
  if (token) {
    try {
      session = await verifySsoSession(token);
    } catch {
      // A malformed or unverifiable cookie is never an authority source.
      session = null;
    }
  }
  if (actionAuthRequired() && !session) throw new HuginnActionSecurityError("unauthorized");
  if (session && requestedOrgId && requestedOrgId !== session.orgId) throw new HuginnActionSecurityError("unauthorized");
  const orgId = session?.orgId ?? requestedOrgId;
  if (!orgId) throw new HuginnActionSecurityError("unauthorized");
  return {
    orgId,
    userId: session?.email,
    principal: session?.email ?? `local:${orgId}`
  };
}

function safeActionFailure(input: { orgId: string; code: HuginnSafeStatus["code"] }) : ClientHuginnResponse {
  const retryable = input.code === "rate_limited" || input.code === "provider_unavailable" || input.code === "deadline_exceeded" || input.code === "internal";
  const answer = input.code === "unauthorized"
    ? "Sign in with an authorized organization session to run Huginn."
    : input.code === "rate_limited"
      ? "Huginn is temporarily rate-limited for this organization. Please retry shortly."
      : "Huginn could not safely complete this request. Please retry shortly.";
  return {
    answer,
    confidence: 0,
    sources: [],
    reasoningTrace: [{ step: "scope", summary: "The Server Action did not trust a client-supplied organization outside an authorized session." }],
    munin: { counts: {} },
    retrieval_layers_used: [],
    narrativeContrast: [],
    eval_log_id: "",
    orgId: input.orgId,
    status: { code: input.code, retryable }
  };
}

/**
 * Browser callers never authorize an arbitrary orgId. In protected runtime a
 * signed SSO session is the authority; local disabled-auth mode preserves the
 * fixture workflow while still applying a bounded action rate limit.
 */
export async function submitHuginnQuestion(
  question: string,
  orgId: string,
  webSearch?: boolean,
  requestId?: string
): Promise<ClientHuginnResponse> {
  try {
    const context = await resolveActionContext(orgId);
    const rateLimit = checkRequestRateLimit(`${context.orgId}:${context.principal}`, "huginn:action", {
      maxRequests: 10,
      windowMs: 60_000
    });
    if (!rateLimit.ok) throw new HuginnActionSecurityError("rate_limited");

    const result = await answerHuginnQuestion({
      question,
      orgId: context.orgId,
      userId: context.userId,
      webSearch,
      requestId,
      temporalMemoryReader: createMuninTemporalMemoryReader()
    });
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
              sources: path.sources.map((ref) => ({ sourceId: ref.sourceId, title: ref.title, url: ref.url }))
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
      narrativeContrast: result.narrativeContrast.map((item) => ({ title: item.title })),
      eval_log_id: result.eval_log_id,
      orgId: result.orgId,
      run: result.run,
      grounding: result.grounding,
      status: result.status,
      citationLedger: result.citationLedger
    };
  } catch (error) {
    if (error instanceof HuginnActionSecurityError) return safeActionFailure({ orgId, code: error.code });
    return safeActionFailure({ orgId, code: "internal" });
  }
}
