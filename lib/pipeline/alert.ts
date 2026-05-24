import { deterministicUuid } from "./idempotency.ts";
import type { AlertDraft, NormalizedSignal, OntologyObjectDraft } from "./types.ts";

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function relatedObjectId(signal: NormalizedSignal, objects: OntologyObjectDraft[]) {
  return objects.find((object) =>
    object.sourceRefs.some((ref) => ref.externalId === signal.externalId || ref.url === signal.sourceRefs[0]?.url)
  )?.id;
}

function alertDraft(input: {
  signal: NormalizedSignal;
  objects: OntologyObjectDraft[];
  priority: AlertDraft["priority"];
  title: string;
  description: string;
  confidence?: number;
}) {
  const dedupeKey = `${input.priority}:${input.signal.source}:${input.signal.fingerprint}:${input.title}`;
  return {
    id: deterministicUuid("alert", dedupeKey),
    dedupeKey,
    priority: input.priority,
    title: input.title,
    description: input.description,
    relatedObjectId: relatedObjectId(input.signal, input.objects),
    evidence: input.signal.sourceRefs,
    orgId: null,
    confidence: input.confidence ?? input.signal.confidence,
    signalFingerprint: input.signal.fingerprint,
    createdAt: input.signal.observedAt
  } satisfies AlertDraft;
}

export function buildAlerts(signals: NormalizedSignal[], objects: OntologyObjectDraft[]): AlertDraft[] {
  const alerts: AlertDraft[] = [];

  for (const signal of signals) {
    if (signal.source === "ferc-elibrary") {
      const capacityMw = numberValue(signal.payload.capacityMw);
      if ((capacityMw ?? 0) >= 1000) {
        alerts.push(
          alertDraft({
            signal,
            objects,
            priority: "critical",
            title: "Large-load power interconnection crossed 1GW",
            description: `${text(signal.payload.applicantRaw) ?? "A filer"} submitted ${capacityMw}MW energy evidence in ${text(signal.payload.docketNumber) ?? signal.externalId}.`,
            confidence: Math.max(signal.confidence, 0.72)
          })
        );
      }
      continue;
    }

    if (signal.source === "county-building-permits") {
      const applicant = text(signal.payload.applicantRaw) ?? "";
      const description = `${text(signal.payload.description) ?? ""} ${text(signal.payload.address) ?? ""}`.toLowerCase();
      if (applicant.toLowerCase().includes("llc") || description.includes("data center")) {
        alerts.push(
          alertDraft({
            signal,
            objects,
            priority: "high",
            title: "Potential SPV-linked construction permit",
            description: `${applicant || "A permit applicant"} appeared in a source-backed land filing.`,
            confidence: Math.max(signal.confidence, 0.68)
          })
        );
      }
      continue;
    }

    if (signal.source === "water-district-permits") {
      const requestedGpd = numberValue(signal.payload.requestedGpd);
      if ((requestedGpd ?? 0) >= 1_000_000) {
        alerts.push(
          alertDraft({
            signal,
            objects,
            priority: "high",
            title: "Large industrial water request detected",
            description: `${text(signal.payload.applicantRaw) ?? "A filer"} requested ${requestedGpd} gallons/day from a water district source.`,
            confidence: Math.max(signal.confidence, 0.66)
          })
        );
      }
      continue;
    }

    if (signal.source === "public-cloud-regions") {
      alerts.push(
        alertDraft({
          signal,
          objects,
          priority: "medium",
          title: "Compute region expansion signal",
          description: `${text(signal.payload.provider) ?? "A cloud provider"} disclosed compute-region expansion evidence.`,
          confidence: signal.confidence
        })
      );
      continue;
    }

    if (signal.layer === "narrative") {
      const title = (text(signal.payload.title) ?? "").toLowerCase();
      const divergenceTerms = ["no ", "not ", "delay", "cancel", "pause", "denies"];
      if (divergenceTerms.some((term) => title.includes(term))) {
        alerts.push(
          alertDraft({
            signal,
            objects,
            priority: "medium",
            title: "Narrative divergence trigger",
            description: "Narrative evidence may conflict with Reality Layer signals; treat as a trigger, not truth.",
            confidence: 0.45
          })
        );
      }
    }
  }

  return alerts;
}
