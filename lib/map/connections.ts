import type { MapConnection } from "./types";

export const DEMO_CONNECTIONS: MapConnection[] = [
  // ── Existing connections (c1–c5) ──────────────────────────────
  {
    id: "c1",
    fromId: "e1",   // Microsoft Iowa → Equinix SG3 (compute backbone)
    toId: "e5",
    confidence: 0.82,
    active: true
  },
  {
    id: "c2",
    fromId: "e8",   // Maersk Rotterdam → Rio Tinto QLD (logistics chain)
    toId: "e9",
    confidence: 0.72,
    active: true
  },
  {
    id: "c3",
    fromId: "e7",   // BHP Pilbara Water → Rio Tinto QLD (materials supply)
    toId: "e9",
    confidence: 0.65,
    active: false
  },
  {
    id: "c4",
    fromId: "e6",   // Saudi Aramco NEOM → Brookfield UK Wind (energy finance)
    toId: "e4",
    confidence: 0.55,
    active: false
  },
  {
    id: "c5",
    fromId: "e1",   // Microsoft Iowa → TSMC Kumamoto (compute supply chain)
    toId: "e10",
    confidence: 0.78,
    active: true
  },

  // ── New connections (c6–c18) ──────────────────────────────────
  {
    id: "c6",
    fromId: "e13",  // Meta Richland Parish → Google Columbus (US compute mesh)
    toId: "e11",
    confidence: 0.75,
    active: true
  },
  {
    id: "c7",
    fromId: "e21",  // BlackRock Climate → NextEra TX Solar (capital → energy)
    toId: "e2",
    confidence: 0.68,
    active: true
  },
  {
    id: "c8",
    fromId: "e19",  // SoftBank Vision Fund → Equinix SG3 (tech investment)
    toId: "e5",
    confidence: 0.62,
    active: false
  },
  {
    id: "c9",
    fromId: "e13",  // Meta DC → Laidley LLC NV (compute → land acquisition)
    toId: "e3",
    confidence: 0.58,
    active: true
  },
  {
    id: "c10",
    fromId: "e21",  // BlackRock Climate → Vistra Odessa Solar (capital flow)
    toId: "e14",
    confidence: 0.71,
    active: true
  },
  {
    id: "c11",
    fromId: "e35",  // CMA CGM Port Klang → DP World Jebel Ali (shipping route)
    toId: "e36",
    confidence: 0.80,
    active: true
  },
  {
    id: "c12",
    fromId: "e10",  // TSMC Kumamoto → Intel Chandler (chip → water reclaim site)
    toId: "e29",
    confidence: 0.67,
    active: false
  },
  {
    id: "c13",
    fromId: "e31",  // Albemarle Li → CATL Kibo Nickel (materials chain)
    toId: "e34",
    confidence: 0.52,
    active: false
  },
  {
    id: "c14",
    fromId: "e32",  // BHP Olympic Dam → Rio Tinto QLD (mining corridor)
    toId: "e9",
    confidence: 0.60,
    active: true
  },
  {
    id: "c15",
    fromId: "e15",  // Ørsted Hornsea → EDF Flamanville (energy network)
    toId: "e16",
    confidence: 0.73,
    active: true
  },
  {
    id: "c16",
    fromId: "e19",  // SoftBank Vision Fund → AWS Hyderabad (tech investment)
    toId: "e12",
    confidence: 0.64,
    active: false
  },
  {
    id: "c17",
    fromId: "e36",  // DP World Jebel Ali → COSCO Piraeus (Med shipping)
    toId: "e37",
    confidence: 0.76,
    active: true
  },
  {
    id: "c18",
    fromId: "e23",  // PIF NEOM Hydrogen → NEOM The Line (capital → land)
    toId: "e25",
    confidence: 0.45,
    active: false
  }
];
