import { deterministicUuid } from "./idempotency.ts";
import type { AuditEventDraft, NormalizedSignal, SourceRef } from "./types.ts";

export function buildAuditEvent(input: {
  eventType: string;
  actor: string;
  signal: NormalizedSignal;
  objectId?: string;
  orgId?: string | null;
  detail: Record<string, unknown>;
  confidence?: number;
  sourceRefs?: SourceRef[];
}): AuditEventDraft {
  const dedupeKey = `${input.eventType}:${input.objectId ?? input.signal.id}:${input.signal.fingerprint}`;
  return {
    id: deterministicUuid("audit_log", dedupeKey),
    dedupeKey,
    eventType: input.eventType,
    actor: input.actor,
    objectId: input.objectId,
    orgId: input.orgId ?? null,
    detail: {
      ...input.detail,
      signalFingerprint: input.signal.fingerprint,
      signalSource: input.signal.source
    },
    confidence: input.confidence ?? input.signal.confidence,
    sourceRefs: input.sourceRefs ?? input.signal.sourceRefs,
    createdAt: input.signal.observedAt
  };
}
