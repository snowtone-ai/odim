import { createHash, randomUUID } from "node:crypto";
import { AiProviderError } from "../../ai/runtime/index.ts";
import type { HuginnPhaseTiming, HuginnRunMetadata, HuginnRunPhase, HuginnRunState, HuginnRunStatus } from "./types.ts";
import { HuginnExecutionError } from "./types.ts";

function normalizeRequestId(value?: string) {
  const trimmed = value?.trim();
  return trimmed && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(trimmed) ? trimmed : randomUUID();
}

function hashQuestion(question: string) {
  return createHash("sha256").update(question).digest("hex");
}

const validTransitions: Record<HuginnRunState, HuginnRunState[]> = {
  received: ["planning", "retrieval", "generation", "verification", "side_effects", "completed", "degraded", "abstained", "failed"],
  planning: ["retrieval", "generation", "verification", "side_effects", "completed", "degraded", "abstained", "failed"],
  retrieval: ["generation", "verification", "side_effects", "completed", "degraded", "abstained", "failed"],
  generation: ["verification", "side_effects", "completed", "degraded", "abstained", "failed"],
  verification: ["side_effects", "completed", "degraded", "abstained", "failed"],
  side_effects: ["completed", "degraded", "abstained", "failed"],
  completed: [],
  degraded: [],
  abstained: [],
  failed: []
};

export type HuginnRun = {
  readonly id: string;
  readonly requestId: string;
  readonly startedAt: number;
  readonly deadlineAt: number;
  readonly queryHash: string;
  readonly state: HuginnRunState;
  transition: (next: HuginnRunState) => void;
  measure: <T>(phase: HuginnRunPhase, task: () => Promise<T>) => Promise<T>;
  skip: (phase: HuginnRunPhase) => void;
  snapshot: (status: HuginnRunStatus) => HuginnRunMetadata;
};

export function createHuginnRun(input: { question: string; requestId?: string; deadlineAt: number; now?: () => number }): HuginnRun {
  const now = input.now ?? Date.now;
  const requestId = normalizeRequestId(input.requestId);
  const startedAt = now();
  const phaseTimings: Partial<Record<HuginnRunPhase, HuginnPhaseTiming>> = {};
  let state: HuginnRunState = "received";

  const transition = (next: HuginnRunState) => {
    if (state === next) return;
    if (!validTransitions[state].includes(next)) {
      throw new Error(`Invalid Huginn run transition: ${state} -> ${next}`);
    }
    state = next;
  };

  return {
    id: `huginn:${requestId}`,
    requestId,
    startedAt,
    deadlineAt: input.deadlineAt,
    queryHash: hashQuestion(input.question),
    get state() {
      return state;
    },
    transition,
    async measure<T>(phase: HuginnRunPhase, task: () => Promise<T>) {
      transition(phase);
      const phaseStartedAt = now();
      try {
        const value = await task();
        phaseTimings[phase] = { ms: Math.max(0, now() - phaseStartedAt), outcome: "ok" };
        return value;
      } catch (error) {
        const timedOut =
          (error instanceof HuginnExecutionError && (error.code === "deadline_exceeded" || error.code === "aborted")) ||
          (error instanceof AiProviderError && (error.kind === "timeout" || error.kind === "aborted"));
        phaseTimings[phase] = {
          ms: Math.max(0, now() - phaseStartedAt),
          outcome: timedOut ? "timeout" : "error"
        };
        throw error;
      }
    },
    skip(phase) {
      if (!phaseTimings[phase]) phaseTimings[phase] = { ms: 0, outcome: "skipped" };
    },
    snapshot(status) {
      transition(status);
      return {
        id: `huginn:${requestId}`,
        requestId,
        status,
        startedAt: new Date(startedAt).toISOString(),
        completedAt: new Date(now()).toISOString(),
        deadlineAt: new Date(input.deadlineAt).toISOString(),
        queryHash: hashQuestion(input.question),
        phaseTimings: { ...phaseTimings }
      };
    }
  };
}
