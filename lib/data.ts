export const layers = ["Energy", "Cash", "Land", "Compute", "Water", "Raw Materials", "Logistics"];

export const entities = [
  { name: "Meta Platforms", score: 86, committed: "$10.2B", lead: 147, confidence: 0.88 },
  { name: "Laidley LLC", score: 71, committed: "$2.4B", lead: 93, confidence: 0.74 },
  { name: "Entergy", score: 79, committed: "$4.8B", lead: 121, confidence: 0.82 }
];

export const alerts = [
  {
    priority: "Critical",
    title: "Louisiana large-load interconnection cluster expanded",
    source: "FERC / state PUC",
    confidence: 0.86
  },
  {
    priority: "High",
    title: "SPV resolution confidence increased for Laidley LLC",
    source: "County filing + hiring pattern",
    confidence: 0.74
  }
];

export const auditEvents = [
  { event: "raw_signal_ingested", actor: "system", confidence: 1, source: "SEC EDGAR" },
  { event: "spv_resolution_updated", actor: "huginn", confidence: 0.74, source: "resolver evidence chain" },
  { event: "alert_created", actor: "system", confidence: 0.86, source: "triangulation" }
];
