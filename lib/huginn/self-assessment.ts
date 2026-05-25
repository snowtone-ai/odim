import { generateStructuredAssessment, type StructuredAssessmentResponse } from "../ai/provider.ts";
import type { RetrievedMemory } from "../munin/memory.ts";

export type SelfAssessmentPlan = StructuredAssessmentResponse;

function clampPlan(plan: StructuredAssessmentResponse): SelfAssessmentPlan {
  const allowed = new Set<SelfAssessmentPlan["source_plan"][number]>(["munin", "odim_cache", "reality_gapfill"]);
  const sourcePlan = (Array.isArray(plan.source_plan) ? plan.source_plan : ["munin"]).filter(
    (item): item is SelfAssessmentPlan["source_plan"][number] => allowed.has(item as SelfAssessmentPlan["source_plan"][number])
  );
  return {
    need_retrieval: Boolean(plan.need_retrieval),
    source_plan: sourcePlan.length ? sourcePlan : ["munin"],
    needs_reality_gapfill: Boolean(plan.needs_reality_gapfill),
    needs_narrative_capture: Boolean(plan.needs_narrative_capture),
    confidence_without_retrieval: Math.max(0, Math.min(1, Number(plan.confidence_without_retrieval) || 0)),
    uses_past_opinion: Boolean(plan.uses_past_opinion)
  };
}

export async function assessQuery(input: {
  question: string;
  orgId?: string;
  coreMemory?: RetrievedMemory[];
  generateFn?: typeof generateStructuredAssessment;
}): Promise<SelfAssessmentPlan> {
  const coreMemory = (input.coreMemory ?? []).map((memory) => `- ${memory.content}`).join("\n");
  const generated = await (input.generateFn ?? generateStructuredAssessment)({
    question: input.question,
    coreMemory,
    orgId: input.orgId
  });
  return clampPlan(generated);
}
