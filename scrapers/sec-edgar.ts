import { normalizeSignal } from "@/lib/pipeline/normalize";

export function buildSecEdgarSignal() {
  return normalizeSignal({
    layer: "cash",
    source: "sec-edgar",
    payload: { form: "8-K", status: "demo" },
    observedAt: new Date().toISOString()
  });
}
