import { structuredParseError } from "./errors.ts";
import type { JsonSchema, StructuredOutputSpec } from "./types.ts";

export type PlannerAssessment = {
  need_retrieval: boolean;
  source_plan: Array<"munin" | "odim_cache" | "reality_gapfill">;
  needs_reality_gapfill: boolean;
  needs_narrative_capture: boolean;
  confidence_without_retrieval: number;
  uses_past_opinion: boolean;
};

export type GraderAssessment = {
  rubric_scores: number[];
  overall_score: number;
  flags: Array<"sycophancy_suspected" | "narrative_as_evidence" | "missing_sources" | "no_uncertainty">;
};

const sourcePlan = ["munin", "odim_cache", "reality_gapfill"];
const graderFlags = ["sycophancy_suspected", "narrative_as_evidence", "missing_sources", "no_uncertainty"];

export const plannerJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "need_retrieval",
    "source_plan",
    "needs_reality_gapfill",
    "needs_narrative_capture",
    "confidence_without_retrieval",
    "uses_past_opinion"
  ],
  properties: {
    need_retrieval: { type: "boolean" },
    source_plan: { type: "array", items: { type: "string", enum: sourcePlan }, minItems: 1 },
    needs_reality_gapfill: { type: "boolean" },
    needs_narrative_capture: { type: "boolean" },
    confidence_without_retrieval: { type: "number", minimum: 0, maximum: 1 },
    uses_past_opinion: { type: "boolean" }
  }
};

export const graderJsonSchema: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rubric_scores", "overall_score", "flags"],
  properties: {
    rubric_scores: { type: "array", minItems: 5, maxItems: 5, items: { type: "number", minimum: 0, maximum: 1 } },
    overall_score: { type: "number", minimum: 0, maximum: 1 },
    flags: { type: "array", items: { type: "string", enum: graderFlags } }
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function boundedNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validatePlanner(value: unknown): PlannerAssessment | null {
  if (!isRecord(value)) return null;
  const keys = [
    "need_retrieval",
    "source_plan",
    "needs_reality_gapfill",
    "needs_narrative_capture",
    "confidence_without_retrieval",
    "uses_past_opinion"
  ];
  if (!hasOnlyKeys(value, keys)) return null;
  if (
    typeof value.need_retrieval !== "boolean" ||
    !Array.isArray(value.source_plan) ||
    value.source_plan.length < 1 ||
    !value.source_plan.every((item) => typeof item === "string" && sourcePlan.includes(item)) ||
    typeof value.needs_reality_gapfill !== "boolean" ||
    typeof value.needs_narrative_capture !== "boolean" ||
    !boundedNumber(value.confidence_without_retrieval) ||
    typeof value.uses_past_opinion !== "boolean"
  ) {
    return null;
  }
  return {
    need_retrieval: value.need_retrieval,
    source_plan: value.source_plan as PlannerAssessment["source_plan"],
    needs_reality_gapfill: value.needs_reality_gapfill,
    needs_narrative_capture: value.needs_narrative_capture,
    confidence_without_retrieval: value.confidence_without_retrieval as number,
    uses_past_opinion: value.uses_past_opinion
  };
}

export function validateGrader(value: unknown): GraderAssessment | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["rubric_scores", "overall_score", "flags"])) return null;
  if (
    !Array.isArray(value.rubric_scores) ||
    value.rubric_scores.length !== 5 ||
    !value.rubric_scores.every(boundedNumber) ||
    !boundedNumber(value.overall_score) ||
    !Array.isArray(value.flags) ||
    !value.flags.every((flag) => typeof flag === "string" && graderFlags.includes(flag))
  ) {
    return null;
  }
  return {
    rubric_scores: value.rubric_scores as number[],
    overall_score: value.overall_score as number,
    flags: value.flags as GraderAssessment["flags"]
  };
}

export const plannerSpec: StructuredOutputSpec<PlannerAssessment> = {
  name: "odim_planner",
  schemaVersion: "planner-v1",
  jsonSchema: plannerJsonSchema,
  validate: validatePlanner
};

export const graderSpec: StructuredOutputSpec<GraderAssessment> = {
  name: "odim_grader",
  schemaVersion: "grader-v1",
  jsonSchema: graderJsonSchema,
  validate: validateGrader
};

export function parseStructuredJson<T>(text: string, spec: StructuredOutputSpec<T>, provider: string): T {
  if (typeof text !== "string" || !text.trim()) throw structuredParseError(provider, "empty structured output");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim()) as unknown;
  } catch {
    throw structuredParseError(provider);
  }
  const value = spec.validate(parsed);
  if (value === null) throw structuredParseError(provider, "schema-invalid structured output");
  return value;
}
