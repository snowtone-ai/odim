export type RawSignal = {
  layer: string;
  source: string;
  payload: Record<string, unknown>;
  observedAt: string;
};

export function normalizeSignal(signal: RawSignal) {
  if (!signal.source) throw new Error("Signal source is required");
  return {
    ...signal,
    layer: signal.layer.toLowerCase(),
    observedAt: new Date(signal.observedAt).toISOString()
  };
}
