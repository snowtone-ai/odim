import type { MapConnection } from "./types";

export const DEMO_CONNECTIONS: MapConnection[] = [
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
    fromId: "e7",   // BHP Pilbara → Rio Tinto QLD (materials supply)
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
  }
];
