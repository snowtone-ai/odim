export type MuninMemory = {
  orgId: string;
  userId?: string;
  agentScope: "core" | "archival" | "recall";
  content: string;
  importance: number;
  decayScore: number;
  linkedMemoryIds: string[];
};

export function assertOrgScoped(memory: MuninMemory, orgId: string) {
  if (memory.orgId !== orgId) throw new Error("Munin memory org isolation violation");
  return memory;
}
