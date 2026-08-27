import type { ReadOnlyToolDefinition } from "./types.ts";

export const READ_ONLY_TOOL_DEFINITIONS: ReadOnlyToolDefinition[] = [
  {
    name: "search_memory",
    description: "Search org-scoped Munin memory without writing or mutating state.",
    inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string" } } }
  },
  {
    name: "search_evidence_graph",
    description: "Search cited evidence graph paths without writing or mutating state.",
    inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string" } } }
  },
  {
    name: "get_alert",
    description: "Read one org-scoped alert.",
    inputSchema: { type: "object", additionalProperties: false, required: ["alertId"], properties: { alertId: { type: "string" } } }
  },
  {
    name: "get_entity",
    description: "Read one org-scoped entity.",
    inputSchema: { type: "object", additionalProperties: false, required: ["entityId"], properties: { entityId: { type: "string" } } }
  },
  {
    name: "compare_sources",
    description: "Compare already-ingested source references without writing or mutating state.",
    inputSchema: { type: "object", additionalProperties: false, required: ["sourceIds"], properties: { sourceIds: { type: "array", items: { type: "string" } } } }
  }
];
