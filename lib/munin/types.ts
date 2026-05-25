export type SourceType =
  | "primary_filing"
  | "official_ir"
  | "odim_derived"
  | "huginn_inference"
  | "user_seed"
  | "web_narrative";

export type MemoryClass = "fact" | "procedure" | "seed" | "opinion";

export type MemoryStatus = "active" | "archived" | "retired";

export type AgentScope = "core" | "archival" | "recall";

export type WriteGateAction = "WRITTEN_TO_MEMORY" | "WRITTEN_TO_OPINIONS" | "REJECTED_FROM_MEMORY";

export type WriteGateCandidate = {
  orgId: string;
  userId?: string;
  content: string;
  sourceType: SourceType;
  memoryClass: MemoryClass;
  agentScope?: AgentScope;
  isSeed?: boolean;
  novelty?: number;
  reliability?: number;
  certainty?: number;
};

export type WriteGateResult = {
  action: WriteGateAction;
  table: "munin_memory" | "munin_opinions" | "raw_signals";
  status?: MemoryStatus;
  salienceScore: number;
  memoryClass: MemoryClass;
  sourceType: SourceType;
  reason: string;
};
