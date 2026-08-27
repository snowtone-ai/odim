export type RuntimeProviderName = "mock" | "gemini" | "openai" | "claude";

export type ProviderErrorKind =
  | "timeout"
  | "aborted"
  | "rate_limit"
  | "auth"
  | "invalid_request"
  | "server"
  | "network"
  | "parse"
  | "circuit_open"
  | "unknown";

export type JsonSchema = Record<string, unknown>;

export type RuntimeRequest = {
  question: string;
  context: string;
  orgId?: string;
};

export type RuntimeResponse = {
  answer: string;
  model: string;
  confidence: number;
  sources: string[];
  provider: RuntimeProviderName;
};

export type StructuredOutputSpec<T> = {
  name: string;
  schemaVersion: string;
  jsonSchema: JsonSchema;
  validate: (value: unknown) => T | null;
};

export type StructuredTransportResponse = {
  text: string;
  model: string;
  confidence?: number;
  sources?: string[];
};

export type ReadOnlyToolName =
  | "search_memory"
  | "search_evidence_graph"
  | "get_alert"
  | "get_entity"
  | "compare_sources";

export type ReadOnlyToolDefinition = {
  name: ReadOnlyToolName;
  description: string;
  inputSchema: JsonSchema;
};

export type ProviderCallOptions = {
  signal: AbortSignal;
  budget: RequestBudget;
};

export type ProviderAdapter = {
  readonly name: RuntimeProviderName;
  readonly model: string;
  generate: (request: RuntimeRequest, options: ProviderCallOptions) => Promise<RuntimeResponse>;
  generateStructured?: <T>(
    request: RuntimeRequest,
    spec: StructuredOutputSpec<T>,
    options: ProviderCallOptions
  ) => Promise<StructuredTransportResponse>;
};
import type { RequestBudget } from "./budget.ts";
