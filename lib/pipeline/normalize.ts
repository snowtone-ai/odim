import { deterministicUuid, sha256Hex } from "./idempotency.ts";
import { signalLayers, type NormalizedSignal, type RawSignal, type SignalLayer } from "./types.ts";

const allowedLayers = new Set<string>(signalLayers);

function normalizeLayer(layer: string): SignalLayer {
  const normalized = layer.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
  if (!allowedLayers.has(normalized)) throw new Error(`Unsupported signal layer: ${layer}`);
  return normalized as SignalLayer;
}

function clamp01(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function requireIsoDate(value: string, fieldName: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${fieldName} must be a valid date`);
  return parsed.toISOString();
}

export function buildSignalFingerprint(signal: RawSignal) {
  return sha256Hex({
    externalId: signal.externalId,
    layer: normalizeLayer(signal.layer),
    payload: signal.payload,
    source: signal.source,
    sourceRefs: signal.sourceRefs.map((ref) => ({
      externalId: ref.externalId,
      sourceId: ref.sourceId,
      title: ref.title,
      url: ref.url
    }))
  });
}

export function normalizeSignal(signal: RawSignal): NormalizedSignal {
  if (!signal.source.trim()) throw new Error("Signal source is required");
  if (!signal.externalId.trim()) throw new Error("Signal externalId is required");
  if (!signal.sourceRefs.length) throw new Error("Signal sourceRefs are required");
  for (const ref of signal.sourceRefs) {
    if (!ref.sourceId.trim() || !ref.url.trim() || !ref.title.trim()) {
      throw new Error("Each sourceRef requires sourceId, url, and title");
    }
  }

  const layer = normalizeLayer(signal.layer);
  const observedAt = requireIsoDate(signal.observedAt, "observedAt");
  const fingerprint = buildSignalFingerprint(signal);

  return {
    ...signal,
    id: deterministicUuid("raw_signal", `${signal.source}:${fingerprint}`),
    layer,
    source: signal.source.trim(),
    externalId: signal.externalId.trim(),
    observedAt,
    fingerprint,
    confidence: clamp01(signal.confidence ?? 0.65, 0.65),
    freshness: clamp01(signal.freshness ?? 1, 1),
    isProprietary: signal.isProprietary ?? false,
    sourceRefs: signal.sourceRefs.map((ref) => ({
      ...ref,
      observedAt: ref.observedAt ? requireIsoDate(ref.observedAt, "sourceRef.observedAt") : observedAt
    }))
  };
}

export function normalizeSignals(signals: RawSignal[]) {
  const byFingerprint = new Map<string, NormalizedSignal>();
  for (const signal of signals) {
    const normalized = normalizeSignal(signal);
    byFingerprint.set(normalized.fingerprint, normalized);
  }
  return [...byFingerprint.values()];
}
